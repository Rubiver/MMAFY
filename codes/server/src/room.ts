import { EMERGENCY_BELL_POSITION, INITIAL_KILL_COOLDOWN_MS, INTERACTION_COLLIDERS, KILL_COOLDOWN_MS, KILL_RANGE, MEETING_DURATION_MS, PLAYER_COLLISION_RADIUS, PLAYER_RUN_SPEED, PLAYER_SPAWN_POSITIONS, PLAYER_WALK_SPEED, SECURITY_SHUTTER_COLLIDER, WORLD_COLLIDERS, type GameState, type MeetingResult, type MeetingState, type NetworkPlayer, type PlayerLifeState, type RoleTeam, type RoomSnapshot, type Vector3Data } from "@mafia/shared";

export const MAX_PLAYERS = 25;
const MAX_INPUT_INTERVAL_MS = 100;
const RECONNECT_GRACE_MS = 30_000;
const SPAWN_POSITION: Vector3Data = PLAYER_SPAWN_POSITIONS[0];

type InternalPlayer = NetworkPlayer & { resumeToken: string; lastMoveAt: number; lastMoveSequence: number; killCooldownEndsAt: number; lastChatAt: number; disconnectedAt?: number };

/** 서버 권한형 대기실과 이동 상태를 관리한다. */
export class GameRoom {
  private readonly players = new Map<string, InternalPlayer>();
  private gameState: GameState = "LOBBY";
  private hostId?: string;
  private mafiaCount?: number;
  private readonly roles = new Map<string, RoleTeam>();
  private meeting?: MeetingState;
  private meetingResult?: MeetingResult;
  private meetingPositions = new Map<string, Vector3Data>();
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
    this.players.set(playerId, { id: playerId, displayName: sanitizeName(displayName), position: { ...SPAWN_POSITION }, rotation: 0, ready: false, connected: true, lifeState: "ALIVE", resumeToken: token, lastMoveAt: now, lastMoveSequence: -1, killCooldownEndsAt: 0, lastChatAt: 0 });
    this.hostId ??= playerId;
    return { resumeToken: token, snapshot: this.snapshot() };
  }

  /** 연결이 끊긴 참가자를 재접속 유예 상태로 표시한다.
   * @returns 연결이 끊긴 참가자가 방장이었는지 여부
   */
  disconnect(playerId: string, now: number): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    const wasHost = this.hostId === playerId;
    player.connected = false;
    player.disconnectedAt = now;
    return wasHost;
  }

  /** 준비 상태를 바꾼다. @throws 존재하지 않는 참가자 */
  setReady(playerId: string, ready: boolean): void {
    const player = this.getPlayer(playerId);
    if (this.gameState !== "LOBBY") throw new RoomError("GAME_STARTED", "게임 중에는 준비 상태를 바꿀 수 없습니다.");
    player.ready = ready;
  }

  /** 준비한 참가자만 있는지 확인하고 게임을 시작한다. */
  startGame(playerId: string, now = Date.now()): void {
    if (playerId !== this.hostId) throw new RoomError("NOT_HOST", "방장만 게임을 시작할 수 있습니다.");
    const connected = [...this.players.values()].filter((player) => player.connected);
    if (connected.length === 0 || connected.some((player) => !player.ready)) throw new RoomError("NOT_READY", "접속 중인 모든 참가자가 준비해야 합니다.");
    const count = this.mafiaCount ?? recommendedMafiaCount(connected.length);
    if (count < 1 || count >= connected.length) throw new RoomError("NOT_READY", "마피아 수가 플레이 인원에 맞지 않습니다.");
    const spawnPositions = shuffleSpawnPositions();
    for (const [index, player] of connected.sort((left, right) => left.id.localeCompare(right.id)).entries()) { const team: RoleTeam = index < count ? "MAFIA" : "SURVIVOR"; this.roles.set(player.id, team); player.position = { ...spawnPositions[index] }; player.rotation = 0; player.killCooldownEndsAt = team === "MAFIA" ? now + INITIAL_KILL_COOLDOWN_MS : 0; }
    this.gameState = "PLAYING";
  }

  /** 방장이 마피아 수를 직접 정한다. */
  setMafiaCount(playerId: string, count: number): void {
    if (playerId !== this.hostId) throw new RoomError("NOT_HOST", "방장만 마피아 수를 정할 수 있습니다.");
    if (this.gameState !== "LOBBY" || !Number.isInteger(count) || count < 1 || count >= this.players.size) throw new RoomError("INVALID_MESSAGE", "마피아 수가 올바르지 않습니다.");
    this.mafiaCount = count;
  }

  /** 서버가 검증한 환경 이동 결과를 지정한 참가자에게 적용한다. */
  teleport(playerId: string, destination: Vector3Data): void {
    const player = this.getPlayer(playerId);
    if (this.gameState !== "PLAYING" || player.lifeState !== "ALIVE") throw new RoomError("INVALID_MESSAGE", "이동할 수 없는 상태입니다.");
    player.position = { ...destination };
  }

  /** 지정 거리 안의 생존자를 처치하고 시체를 남긴다. */
  kill(playerId: string, targetId: string, now: number): void {
    const killer = this.getPlayer(playerId); const target = this.getPlayer(targetId);
    if (this.gameState !== "PLAYING" || this.roles.get(playerId) !== "MAFIA" || this.roles.get(targetId) !== "SURVIVOR" || killer.lifeState !== "ALIVE" || target.lifeState !== "ALIVE" || playerId === targetId || distance(killer.position, target.position) > KILL_RANGE) throw new RoomError("INVALID_MESSAGE", "처치 조건을 만족하지 않습니다.");
    if (now < killer.killCooldownEndsAt) throw new RoomError("INVALID_MESSAGE", "처치 재사용 대기 중입니다.");
    killer.killCooldownEndsAt = now + KILL_COOLDOWN_MS; target.lifeState = "DEAD"; target.bodyId = `body-${target.id}-${now}`; this.checkMafiaWin();
  }

  /** 시체를 신고해 회의를 시작한다. */
  report(playerId: string, bodyId: string, now: number): void {
    const reporter = this.getPlayer(playerId); const body = [...this.players.values()].find((player) => player.bodyId === bodyId);
    if (this.gameState !== "PLAYING" || reporter.lifeState !== "ALIVE" || !body || distance(reporter.position, body.position) > 2) throw new RoomError("INVALID_MESSAGE", "신고 조건을 만족하지 않습니다.");
    this.beginMeeting(playerId, bodyId, now);
  }

  /** 생존자가 긴급 회의를 연다. */
  callMeeting(playerId: string, now: number): void { const player = this.getPlayer(playerId); if (this.gameState !== "PLAYING" || player.lifeState !== "ALIVE" || distance(player.position, EMERGENCY_BELL_POSITION) > 2.4) throw new RoomError("INVALID_MESSAGE", "긴급 회의 종 가까이에서만 회의를 시작할 수 있습니다."); this.beginMeeting(playerId, undefined, now); }
  /** 이전 클라이언트의 투표 시작 요청은 90초 통합 회의에서 별도 상태 전환 없이 허용한다. */
  startVoting(playerId: string): void { if (this.gameState !== "MEETING" || playerId !== this.hostId) throw new RoomError("NOT_HOST", "방장만 투표를 시작할 수 있습니다."); }
  /** 생존자의 한 표를 기록한다. 생존자 과반이 건너뛰기를 고르면 즉시 회의를 끝낸다. */
  vote(playerId: string, targetId: string | "SKIP", now = Date.now()): void {
    const voter = this.getPlayer(playerId); if (this.gameState !== "MEETING" || voter.lifeState !== "ALIVE" || !this.meeting || this.meeting.votes[playerId]) throw new RoomError("INVALID_MESSAGE", "투표 조건을 만족하지 않습니다.");
    if (targetId !== "SKIP" && !this.players.has(targetId)) throw new RoomError("INVALID_MESSAGE", "투표 대상을 찾을 수 없습니다.");
    this.meeting.votes[playerId] = targetId;
    const aliveCount = [...this.players.values()].filter((player) => player.lifeState === "ALIVE" && player.connected).length;
    const skipCount = Object.values(this.meeting.votes).filter((target) => target === "SKIP").length;
    if (skipCount >= Math.floor(aliveCount / 2) + 1) this.finishVote(now, true);
  }

  /** 회의 중 살아 있는 참가자의 짧은 채팅을 기록한다. */
  chat(playerId: string, text: string, now: number): void {
    const player = this.getPlayer(playerId); const message = sanitizeChat(text);
    if (this.gameState !== "MEETING" || player.lifeState !== "ALIVE" || !player.connected || !this.meeting || !message) throw new RoomError("INVALID_MESSAGE", "회의 중 살아 있는 참가자만 채팅할 수 있습니다.");
    if (now - player.lastChatAt < 500) throw new RoomError("INVALID_MESSAGE", "채팅은 잠시 뒤 다시 보낼 수 있습니다.");
    player.lastChatAt = now;
    this.meeting.messages.push({ id: `chat-${player.id}-${now}`, playerId, displayName: player.displayName, text: message, sentAt: now });
    if (this.meeting.messages.length > 100) this.meeting.messages.shift();
  }

  /** 회의 제한 시간이 지나면 서버가 투표 결과를 확정한다.
   * @param now 현재 시각
   * @returns 상태가 변경됐는지 여부
   */
  advance(now: number): boolean {
    if (this.gameState === "MEETING" && this.meeting && now >= this.meeting.endsAt) { this.finishVote(now); return true; }
    if (this.gameState === "VOTING" && this.meetingResult && now >= this.meetingResult.endsAt) { this.completeMeetingResult(); return true; }
    return false;
  }

  /** 입력 방향을 속도와 최대 시간 간격으로 제한해 위치에 적용한다. */
  move(playerId: string, direction: { x: number; z: number }, rotation: number, run: boolean, now: number, sequence = now, shutterClosed = false, inputBlocked = false): Vector3Data | undefined {
    const player = this.getPlayer(playerId);
    if (this.gameState !== "PLAYING" || player.lifeState !== "ALIVE" || !player.connected || inputBlocked || sequence <= player.lastMoveSequence) return undefined;
    if (!Number.isFinite(direction.x) || !Number.isFinite(direction.z) || !Number.isFinite(rotation)) throw new RoomError("INVALID_MESSAGE", "이동 입력 값이 올바르지 않습니다.");
    const elapsed = Math.min(Math.max(now - player.lastMoveAt, 0), MAX_INPUT_INTERVAL_MS) / 1000;
    player.lastMoveAt = now;
    player.lastMoveSequence = sequence;
    const length = Math.hypot(direction.x, direction.z);
    const factor = length > 1 ? 1 / length : 1;
    const speed = run ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED; const movement = { x: direction.x * factor * speed * elapsed, z: direction.z * factor * speed * elapsed };
    player.position = resolveMovement(player.position, movement, shutterClosed);
    player.rotation = Number.isFinite(rotation) ? normalizeYaw(rotation) : player.rotation;
    return { ...player.position };
  }

  /** 재접속 유예를 넘긴 참가자를 삭제한다. */
  pruneDisconnected(now: number): void {
    for (const player of this.players.values()) if (player.disconnectedAt && now - player.disconnectedAt > RECONNECT_GRACE_MS) this.players.delete(player.id);
    if (this.hostId && !this.players.has(this.hostId)) this.hostId = undefined;
  }

  /** 클라이언트 전파용 안전한 방 상태를 만든다. */
  snapshot(): RoomSnapshot {
    const meeting = this.meeting ? { ...this.meeting, votes: { ...this.meeting.votes }, messages: this.meeting.messages.map((message) => ({ ...message })) } : undefined;
    return { roomId: this.roomId, hostId: this.hostId ?? "", gameState: this.gameState, maxPlayers: MAX_PLAYERS, players: [...this.players.values()].map(({ resumeToken: _token, lastMoveAt: _lastMoveAt, lastMoveSequence: _lastMoveSequence, killCooldownEndsAt: _killCooldownEndsAt, lastChatAt: _lastChatAt, disconnectedAt: _disconnectedAt, ...player }) => ({ ...player, position: { ...player.position } })), meeting, meetingResult: this.meetingResult ? { ...this.meetingResult } : undefined, result: this.result };
  }

  /** 본인에게만 보낼 역할과 마피아 동료 정보를 반환한다. */
  roleInfo(playerId: string): { team: RoleTeam; mafiaIds: string[] } { const team = this.roles.get(playerId) ?? "SURVIVOR"; return { team, mafiaIds: team === "MAFIA" ? [...this.roles.entries()].filter(([, value]) => value === "MAFIA").map(([id]) => id) : [] }; }

  /** 지정한 마피아의 처치 재사용 대기 시간을 밀리초로 반환한다. */
  killCooldownRemainingMs(playerId: string, now: number): number { const player = this.getPlayer(playerId); return this.roles.get(playerId) === "MAFIA" ? Math.max(0, player.killCooldownEndsAt - now) : 0; }
  /** 시민 공통 임무가 모두 끝났을 때 서버가 시민 승리를 확정한다. */
  completeTaskVictory(): void { if (this.gameState !== "PLAYING") throw new RoomError("INVALID_MESSAGE", "임무 승리를 확정할 수 없는 상태입니다."); this.result = { winner: "SURVIVOR" }; this.gameState = "GAME_OVER"; }

  /** 참가자 존재 여부를 검증한다. */
  private getPlayer(playerId: string): InternalPlayer {
    const player = this.players.get(playerId);
    if (!player) throw new RoomError("INVALID_MESSAGE", "존재하지 않는 참가자입니다.");
    return player;
  }

  /** 신고자와 종료 시각을 기록하고 90초 통합 회의를 시작한다. */
  /** 회의 전 위치를 복사해 결과 연출 뒤 같은 지점에서 플레이를 재개한다. */
  private beginMeeting(reporterId: string, bodyId: string | undefined, now: number): void { this.meetingPositions = new Map([...this.players.values()].map((player) => [player.id, { ...player.position }])); this.meeting = { reporterId, bodyId, votes: {}, endsAt: now + MEETING_DURATION_MS, messages: [] }; this.meetingResult = undefined; this.gameState = "MEETING"; }
  /** 표를 집계해 건너뛰기 또는 처형 결과를 3초간 전파한다. */
  private finishVote(now: number, forcedSkip = false): void { if (!this.meeting) return; const counts = new Map<string, number>(); for (const target of Object.values(this.meeting.votes)) counts.set(target, (counts.get(target) ?? 0) + 1); const top = [...counts.entries()].sort((a, b) => b[1] - a[1]); const expelled = !forcedSkip && top.length && (top.length === 1 || top[0][1] > top[1][1]) && top[0][0] !== "SKIP" ? top[0][0] : undefined; this.meeting = undefined; this.meetingResult = { type: expelled ? "EXPEL" : "SKIP", expelledId: expelled, endsAt: now + 3_000 }; this.gameState = "VOTING"; }
  /** 결과 연출 시간이 끝나면 처형을 확정하고 회의 전 위치에서 게임을 재개한다. */
  private completeMeetingResult(): void { const expelled = this.meetingResult?.expelledId; if (expelled) { const player = this.getPlayer(expelled); player.lifeState = "GHOST"; player.bodyId = undefined; } for (const player of this.players.values()) { const position = this.meetingPositions.get(player.id); if (position) player.position = { ...position }; } this.meetingPositions.clear(); this.meetingResult = undefined; this.gameState = "PLAYING"; }
  /** 살아 있는 마피아가 시민 수와 같거나 많아지면 마피아 승리를 확정한다. */
  private checkMafiaWin(): void { const alive = [...this.players.values()].filter((player) => player.lifeState === "ALIVE"); const mafia = alive.filter((player) => this.roles.get(player.id) === "MAFIA"); const survivors = alive.length - mafia.length; if (mafia.length > 0 && mafia.length >= survivors) { this.result = { winner: "MAFIA" }; this.gameState = "GAME_OVER"; } }
}

/** 방 규칙 검증 실패를 클라이언트 오류로 변환한다. */
export class RoomError extends Error {
  constructor(readonly code: "ROOM_FULL" | "INVALID_MESSAGE" | "NOT_HOST" | "NOT_READY" | "GAME_STARTED", message: string) { super(message); }
}

/** 표시 이름을 화면과 로그에 안전한 길이로 정리한다. */
function sanitizeName(value: string): string { return value.trim().slice(0, 16) || randomDisplayName(); }
/** 이름을 비운 참가자에게 표시할 친근한 무작위 별명을 만든다. */
function randomDisplayName(): string { const adjectives = ["배고픈", "화난", "졸린", "용감한", "재빠른", "호기심 많은"]; const animals = ["비버", "토끼", "수달", "너구리", "부엉이", "고슴도치"]; return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`; }
/** 채팅 본문을 공백 정리와 최대 길이 제한으로 안전하게 만든다. */
function sanitizeChat(value: string): string { return value.trim().slice(0, 160); }
/** 플레이 인원의 20%를 내림한 추천 마피아 수를 반환한다. */
export function recommendedMafiaCount(playerCount: number): number { return Math.floor(playerCount * 0.2); }
/** 두 위치의 수평 거리를 반환한다. */
function distance(left: Vector3Data, right: Vector3Data): number { return Math.hypot(left.x - right.x, left.z - right.z); }

/** 서버가 장애물과 겹치지 않는 권한형 이동 좌표를 계산한다.
 * @param position 현재 위치
 * @param movement 이번 입력에서 허용된 수평 이동량
 * @returns 장애물 충돌을 해소한 새 위치
 */
function resolveMovement(position: Vector3Data, movement: { x: number; z: number }, shutterClosed = false): Vector3Data {
  const candidate = { x: position.x + movement.x, y: SPAWN_POSITION.y, z: position.z + movement.z };
  if (isWalkable(candidate, shutterClosed)) return candidate;
  const xOnly = { x: candidate.x, y: SPAWN_POSITION.y, z: position.z };
  if (isWalkable(xOnly, shutterClosed)) return xOnly;
  const zOnly = { x: position.x, y: SPAWN_POSITION.y, z: candidate.z };
  return isWalkable(zOnly, shutterClosed) ? zOnly : { x: position.x, y: SPAWN_POSITION.y, z: position.z };
}

/** 플레이어 충돌 원이 맵 충돌 상자와 겹치지 않는지 판정한다.
 * @param position 확인할 플레이어 위치
 * @returns 이동 가능한지 여부
 */
function isWalkable(position: Vector3Data, shutterClosed: boolean): boolean {
  return [...WORLD_COLLIDERS, ...INTERACTION_COLLIDERS, ...(shutterClosed ? [SECURITY_SHUTTER_COLLIDER] : [])].every((collider) => Math.abs(position.x - collider.position.x) > collider.size.x / 2 + PLAYER_COLLISION_RADIUS || Math.abs(position.z - collider.position.z) > collider.size.z / 2 + PLAYER_COLLISION_RADIUS);
}

/** 임의의 회전값을 원격 화면이 동일하게 해석할 수 있는 -파이부터 파이 사이 yaw로 정리한다. */
function normalizeYaw(rotation: number): number { return ((rotation + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }

/** 스폰 위치를 섞어 각 참가자에게 서로 다른 시작 지점을 배정한다.
 * @returns 순서가 무작위인 안전한 스폰 위치 목록
 */
function shuffleSpawnPositions(): Vector3Data[] {
  const positions = PLAYER_SPAWN_POSITIONS.map((position) => ({ ...position }));
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [positions[index], positions[randomIndex]] = [positions[randomIndex], positions[index]];
  }
  return positions;
}
