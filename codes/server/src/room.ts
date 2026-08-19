import type { GameState, NetworkPlayer, PlayerLifeState, RoleTeam, RoomSnapshot, Vector3Data } from "@mafia/shared";

export const MAX_PLAYERS = 25;
const MOVE_SPEED = 4;
const MAX_INPUT_INTERVAL_MS = 100;
const RECONNECT_GRACE_MS = 30_000;
const SPAWN_POSITION: Vector3Data = { x: 0, y: 1.4, z: 4 };

type InternalPlayer = NetworkPlayer & { resumeToken: string; lastMoveAt: number; disconnectedAt?: number };

/** 서버 권한형 대기실과 이동 상태를 관리한다. */
export class GameRoom {
  private readonly players = new Map<string, InternalPlayer>();
  private gameState: GameState = "LOBBY";
  private hostId?: string;
  private mafiaCount?: number;
  private readonly roles = new Map<string, RoleTeam>();
  private meeting?: { reporterId: string; bodyId?: string; votes: Record<string, string | "SKIP"> };
  private result?: { winner: RoleTeam; expelledId?: string };

  /** @param roomId 사람이 확인할 수 있는 방 식별자 */
  constructor(private readonly roomId: string) {}

  /** 새 참가자를 방에 넣거나 재접속 참가자를 복구한다. @throws 방 정원이 찼거나 게임이 시작된 경우 */
  join(playerId: string, displayName: string, resumeToken: string | undefined, now: number): { resumeToken: string; snapshot: RoomSnapshot } {
    const reconnecting = resumeToken ? [...this.players.values()].find((player) => player.resumeToken === resumeToken) : undefined;
    if (reconnecting && reconnecting.disconnectedAt && now - reconnecting.disconnectedAt <= RECONNECT_GRACE_MS) {
      this.players.delete(reconnecting.id);
      reconnecting.id = playerId;
      reconnecting.displayName = sanitizeName(displayName);
      reconnecting.connected = true;
      reconnecting.disconnectedAt = undefined;
      reconnecting.lastMoveAt = now;
      this.players.set(playerId, reconnecting);
      if (this.hostId === undefined) this.hostId = playerId;
      return { resumeToken: reconnecting.resumeToken, snapshot: this.snapshot() };
    }
    if (this.gameState !== "LOBBY") throw new RoomError("GAME_STARTED", "이미 게임이 시작되었습니다.");
    if (this.players.size >= MAX_PLAYERS) throw new RoomError("ROOM_FULL", "방 정원이 가득 찼습니다.");
    const token = crypto.randomUUID();
    this.players.set(playerId, { id: playerId, displayName: sanitizeName(displayName), position: { ...SPAWN_POSITION }, rotation: 0, ready: false, connected: true, lifeState: "ALIVE", resumeToken: token, lastMoveAt: now });
    this.hostId ??= playerId;
    return { resumeToken: token, snapshot: this.snapshot() };
  }

  /** 연결이 끊긴 참가자를 재접속 유예 상태로 표시한다. */
  disconnect(playerId: string, now: number): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    player.disconnectedAt = now;
    if (this.hostId === playerId) this.hostId = this.firstConnectedId();
  }

  /** 준비 상태를 바꾼다. @throws 존재하지 않는 참가자 */
  setReady(playerId: string, ready: boolean): void {
    const player = this.getPlayer(playerId);
    if (this.gameState !== "LOBBY") throw new RoomError("GAME_STARTED", "게임 중에는 준비 상태를 바꿀 수 없습니다.");
    player.ready = ready;
  }

  /** 준비한 참가자만 있는지 확인하고 게임을 시작한다. */
  startGame(playerId: string): void {
    if (playerId !== this.hostId) throw new RoomError("NOT_HOST", "방장만 게임을 시작할 수 있습니다.");
    const connected = [...this.players.values()].filter((player) => player.connected);
    if (connected.length === 0 || connected.some((player) => !player.ready)) throw new RoomError("NOT_READY", "접속 중인 모든 참가자가 준비해야 합니다.");
    const count = this.mafiaCount ?? recommendedMafiaCount(connected.length);
    if (count < 1 || count >= connected.length) throw new RoomError("NOT_READY", "마피아 수가 플레이 인원에 맞지 않습니다.");
    for (const [index, player] of connected.sort((left, right) => left.id.localeCompare(right.id)).entries()) this.roles.set(player.id, index < count ? "MAFIA" : "SURVIVOR");
    this.gameState = "PLAYING";
  }

  /** 방장이 마피아 수를 직접 정한다. */
  setMafiaCount(playerId: string, count: number): void {
    if (playerId !== this.hostId) throw new RoomError("NOT_HOST", "방장만 마피아 수를 정할 수 있습니다.");
    if (this.gameState !== "LOBBY" || !Number.isInteger(count) || count < 1 || count >= this.players.size) throw new RoomError("INVALID_MESSAGE", "마피아 수가 올바르지 않습니다.");
    this.mafiaCount = count;
  }

  /** 지정 거리 안의 생존자를 처치하고 시체를 남긴다. */
  kill(playerId: string, targetId: string, now: number): void {
    const killer = this.getPlayer(playerId); const target = this.getPlayer(targetId);
    if (this.gameState !== "PLAYING" || this.roles.get(playerId) !== "MAFIA" || killer.lifeState !== "ALIVE" || target.lifeState !== "ALIVE" || playerId === targetId || distance(killer.position, target.position) > 2) throw new RoomError("INVALID_MESSAGE", "처치 조건을 만족하지 않습니다.");
    target.lifeState = "DEAD"; target.bodyId = `body-${target.id}-${now}`; this.checkWin();
  }

  /** 시체를 신고해 회의를 시작한다. */
  report(playerId: string, bodyId: string): void {
    const reporter = this.getPlayer(playerId); const body = [...this.players.values()].find((player) => player.bodyId === bodyId);
    if (this.gameState !== "PLAYING" || reporter.lifeState !== "ALIVE" || !body || distance(reporter.position, body.position) > 2) throw new RoomError("INVALID_MESSAGE", "신고 조건을 만족하지 않습니다.");
    this.meeting = { reporterId: playerId, bodyId, votes: {} }; this.gameState = "MEETING";
  }

  /** 생존자가 긴급 회의를 연다. */
  callMeeting(playerId: string): void { const player = this.getPlayer(playerId); if (this.gameState !== "PLAYING" || player.lifeState !== "ALIVE") throw new RoomError("INVALID_MESSAGE", "회의를 시작할 수 없습니다."); this.meeting = { reporterId: playerId, votes: {} }; this.gameState = "MEETING"; }
  /** 회의 토론을 종료하고 투표 단계로 바꾼다. */
  startVoting(playerId: string): void { if (this.gameState !== "MEETING" || playerId !== this.hostId) throw new RoomError("NOT_HOST", "방장만 투표를 시작할 수 있습니다."); this.gameState = "VOTING"; }
  /** 생존자의 한 표를 기록하고 모두 투표하면 결과를 확정한다. */
  vote(playerId: string, targetId: string | "SKIP"): void {
    const voter = this.getPlayer(playerId); if (this.gameState !== "VOTING" || voter.lifeState !== "ALIVE" || !this.meeting || this.meeting.votes[playerId]) throw new RoomError("INVALID_MESSAGE", "투표 조건을 만족하지 않습니다.");
    if (targetId !== "SKIP" && (!this.players.has(targetId) || this.getPlayer(targetId).lifeState !== "ALIVE")) throw new RoomError("INVALID_MESSAGE", "투표 대상을 찾을 수 없습니다.");
    this.meeting.votes[playerId] = targetId;
    if (Object.keys(this.meeting.votes).length === [...this.players.values()].filter((player) => player.lifeState === "ALIVE" && player.connected).length) this.finishVote();
  }

  /** 입력 방향을 속도와 최대 시간 간격으로 제한해 위치에 적용한다. */
  move(playerId: string, direction: { x: number; z: number }, rotation: number, now: number): boolean {
    const player = this.getPlayer(playerId);
    if (this.gameState !== "PLAYING" || !player.connected) return false;
    if (!Number.isFinite(direction.x) || !Number.isFinite(direction.z) || !Number.isFinite(rotation)) throw new RoomError("INVALID_MESSAGE", "이동 입력 값이 올바르지 않습니다.");
    const elapsed = Math.min(Math.max(now - player.lastMoveAt, 0), MAX_INPUT_INTERVAL_MS) / 1000;
    player.lastMoveAt = now;
    const length = Math.hypot(direction.x, direction.z);
    const factor = length > 1 ? 1 / length : 1;
    player.position = { x: player.position.x + direction.x * factor * MOVE_SPEED * elapsed, y: SPAWN_POSITION.y, z: player.position.z + direction.z * factor * MOVE_SPEED * elapsed };
    player.rotation = Number.isFinite(rotation) ? rotation : player.rotation;
    return true;
  }

  /** 재접속 유예를 넘긴 참가자를 삭제한다. */
  pruneDisconnected(now: number): void {
    for (const player of this.players.values()) if (player.disconnectedAt && now - player.disconnectedAt > RECONNECT_GRACE_MS) this.players.delete(player.id);
    if (this.hostId && !this.players.has(this.hostId)) this.hostId = this.firstConnectedId();
  }

  /** 클라이언트 전파용 안전한 방 상태를 만든다. */
  snapshot(): RoomSnapshot {
    return { roomId: this.roomId, hostId: this.hostId ?? "", gameState: this.gameState, maxPlayers: MAX_PLAYERS, players: [...this.players.values()].map(({ resumeToken: _token, lastMoveAt: _lastMoveAt, disconnectedAt: _disconnectedAt, ...player }) => ({ ...player, position: { ...player.position } })), meeting: this.meeting, result: this.result };
  }

  /** 본인에게만 보낼 역할과 마피아 동료 정보를 반환한다. */
  roleInfo(playerId: string): { team: RoleTeam; mafiaIds: string[] } { const team = this.roles.get(playerId) ?? "SURVIVOR"; return { team, mafiaIds: team === "MAFIA" ? [...this.roles.entries()].filter(([, value]) => value === "MAFIA").map(([id]) => id) : [] }; }

  /** 참가자 존재 여부를 검증한다. */
  private getPlayer(playerId: string): InternalPlayer {
    const player = this.players.get(playerId);
    if (!player) throw new RoomError("INVALID_MESSAGE", "존재하지 않는 참가자입니다.");
    return player;
  }

  /** 다음 방장을 찾는다. */
  private firstConnectedId(): string | undefined { return [...this.players.values()].find((player) => player.connected)?.id; }
  /** 투표 최다 득표자를 추방하고 승패를 확인한다. */
  private finishVote(): void { if (!this.meeting) return; const counts = new Map<string, number>(); for (const target of Object.values(this.meeting.votes)) counts.set(target, (counts.get(target) ?? 0) + 1); const top = [...counts.entries()].sort((a, b) => b[1] - a[1]); const expelled = top.length && (top.length === 1 || top[0][1] > top[1][1]) && top[0][0] !== "SKIP" ? top[0][0] : undefined; if (expelled) { const player = this.getPlayer(expelled); player.lifeState = "GHOST"; player.bodyId = undefined; } this.result = this.result ?? undefined; this.meeting = undefined; this.gameState = "PLAYING"; this.checkWin(expelled); }
  /** 남은 생존자와 마피아 수로 승패를 확정한다. */
  private checkWin(expelledId?: string): void { const alive = [...this.players.values()].filter((player) => player.lifeState === "ALIVE"); const mafia = alive.filter((player) => this.roles.get(player.id) === "MAFIA"); if (mafia.length === 0 || mafia.length >= alive.length - mafia.length) { this.result = { winner: mafia.length === 0 ? "SURVIVOR" : "MAFIA", expelledId }; this.gameState = "GAME_OVER"; } }
}

/** 방 규칙 검증 실패를 클라이언트 오류로 변환한다. */
export class RoomError extends Error {
  constructor(readonly code: "ROOM_FULL" | "INVALID_MESSAGE" | "NOT_HOST" | "NOT_READY" | "GAME_STARTED", message: string) { super(message); }
}

/** 표시 이름을 화면과 로그에 안전한 길이로 정리한다. */
function sanitizeName(value: string): string { return value.trim().slice(0, 16) || "이름 없는 참가자"; }
/** 플레이 인원의 20%를 내림한 추천 마피아 수를 반환한다. */
export function recommendedMafiaCount(playerCount: number): number { return Math.floor(playerCount * 0.2); }
/** 두 위치의 수평 거리를 반환한다. */
function distance(left: Vector3Data, right: Vector3Data): number { return Math.hypot(left.x - right.x, left.z - right.z); }
