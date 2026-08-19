import type { GameState, NetworkPlayer, RoomSnapshot, Vector3Data } from "@mafia/shared";

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
    this.players.set(playerId, { id: playerId, displayName: sanitizeName(displayName), position: { ...SPAWN_POSITION }, rotation: 0, ready: false, connected: true, resumeToken: token, lastMoveAt: now });
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
    this.gameState = "PLAYING";
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
    return { roomId: this.roomId, hostId: this.hostId ?? "", gameState: this.gameState, maxPlayers: MAX_PLAYERS, players: [...this.players.values()].map(({ resumeToken: _token, lastMoveAt: _lastMoveAt, disconnectedAt: _disconnectedAt, ...player }) => ({ ...player, position: { ...player.position } })) };
  }

  /** 참가자 존재 여부를 검증한다. */
  private getPlayer(playerId: string): InternalPlayer {
    const player = this.players.get(playerId);
    if (!player) throw new RoomError("INVALID_MESSAGE", "존재하지 않는 참가자입니다.");
    return player;
  }

  /** 다음 방장을 찾는다. */
  private firstConnectedId(): string | undefined { return [...this.players.values()].find((player) => player.connected)?.id; }
}

/** 방 규칙 검증 실패를 클라이언트 오류로 변환한다. */
export class RoomError extends Error {
  constructor(readonly code: "ROOM_FULL" | "INVALID_MESSAGE" | "NOT_HOST" | "NOT_READY" | "GAME_STARTED", message: string) { super(message); }
}

/** 표시 이름을 화면과 로그에 안전한 길이로 정리한다. */
function sanitizeName(value: string): string { return value.trim().slice(0, 16) || "이름 없는 참가자"; }
