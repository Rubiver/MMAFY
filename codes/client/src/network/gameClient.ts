import type { ClientMessage, GeneratorId, RoomSnapshot, ServerMessage } from "@mafia/shared";
import { useGameStore } from "../store/gameStore";

type Listener = (snapshot: RoomSnapshot, playerId: string) => void;
type ErrorListener = (message: string) => void;
let activeClient: GameClient | undefined;
const ROOM_CODE_KEY = "mafia-room-code";
const RESUME_TOKEN_KEY = "mafia-resume-token";
const DISPLAY_NAME_KEY = "mafia-display-name";

/** 현재 게임 화면이 사용할 연결 객체를 등록한다. */
export function setActiveGameClient(client: GameClient): void { activeClient = client; }
/** 현재 활성화된 게임 연결 객체를 반환한다. */
export function getActiveGameClient(): GameClient | undefined { return activeClient; }

/** 방 코드 기반 WebSocket 연결과 서버 권한 상태 수신을 관리한다. */
export class GameClient {
  private socket?: WebSocket;
  private playerId = "";
  private roomClosed = false;
  private resumeToken = localStorage.getItem(RESUME_TOKEN_KEY) ?? undefined;
  private roomCode = localStorage.getItem(ROOM_CODE_KEY) ?? undefined;

  /** @param onState 방 상태 수신 처리기 @param onError 오류 표시 처리기 */
  constructor(private readonly onState: Listener, private readonly onError: ErrorListener) {}
  /** 새 방을 만들고 방장으로 입장한다. */
  createRoom(displayName: string): void { this.open(displayName, { type: "CREATE_ROOM", displayName }); }
  /** 방 코드로 기존 방에 입장한다. */
  joinRoom(displayName: string, roomCode: string): void { this.open(displayName, { type: "JOIN", displayName, roomCode: roomCode.trim().toUpperCase(), resumeToken: this.resumeToken }); }
  /** 새로고침 뒤 저장된 방 코드와 토큰으로 재접속한다. */
  reconnect(): void { const name = localStorage.getItem(DISPLAY_NAME_KEY); if (name && this.roomCode) this.joinRoom(name, this.roomCode); }
  /** 저장된 재접속 정보가 있는지 반환한다. */
  hasSavedSession(): boolean { return Boolean(this.roomCode && localStorage.getItem(DISPLAY_NAME_KEY)); }
  /** 준비 상태 변경을 서버에 요청한다. */
  setReady(ready: boolean): void { this.send({ type: "SET_READY", ready }); }
  /** 방장 권한으로 현재 방을 닫고 저장된 재접속 정보를 지운다. */
  deleteRoom(): void { this.send({ type: "DELETE_ROOM" }); }
  startGame(): void { this.send({ type: "START_GAME" }); }
  setMafiaCount(count: number): void { this.send({ type: "SET_MAFIA_COUNT", count }); }
  kill(targetId: string): void { this.send({ type: "KILL", targetId }); }
  /** 가까운 시체를 서버에 신고한다. */
  report(bodyId: string): void { this.send({ type: "REPORT", bodyId }); }
  callMeeting(): void { this.send({ type: "CALL_MEETING" }); }
  startVoting(): void { this.send({ type: "START_VOTING" }); }
  vote(targetId: string | "SKIP"): void { this.send({ type: "VOTE", targetId }); }
  /** 회의 중 모든 생존자에게 보일 짧은 채팅을 요청한다. */
  chat(text: string): void { this.send({ type: "CHAT", text }); }
  environment(action: "SABOTAGE" | "REPAIR_START" | "REPAIR_COMPLETE" | "REPAIR_CANCEL" | "VENT" | "TASK" | "DOOR_TOGGLE" | "DOOR_LOCK" | "CCTV_OPEN" | "CCTV_CLOSE" | "COMM_SABOTAGE" | "COMM_REPAIR", deviceId?: GeneratorId, puzzle?: string[]): void { this.send({ type: "ENVIRONMENT", action, deviceId, puzzle }); }
  /** 입력 순번을 포함한 이동 요청을 서버에 보낸다. */
  move(direction: { x: number; z: number }, rotation: number, run: boolean, sequence: number): void { this.send({ type: "MOVE", direction, rotation, run, sequence }); }

  /** WebSocket을 열고 최초 입장 메시지를 보낸다. */
  private open(displayName: string, message: Extract<ClientMessage, { type: "CREATE_ROOM" | "JOIN" }>): void {
    this.socket?.close(); this.roomClosed = false; localStorage.setItem(DISPLAY_NAME_KEY, displayName);
    this.socket = new WebSocket(import.meta.env.VITE_GAME_SERVER_URL ?? "ws://localhost:2567");
    this.socket.addEventListener("open", () => this.send(message));
    this.socket.addEventListener("message", (event) => this.handleMessage(JSON.parse(String(event.data)) as ServerMessage));
    this.socket.addEventListener("close", () => { if (!this.roomClosed) this.onError("서버 연결이 끊겼습니다. 다시 연결해 주세요."); });
    this.socket.addEventListener("error", () => this.onError("게임 서버에 연결할 수 없습니다. 서버를 먼저 실행해 주세요."));
  }
  /** 서버 메시지별로 방·역할·환경 상태를 갱신한다. */
  private handleMessage(message: ServerMessage): void {
    if (message.type === "WELCOME") { this.playerId = message.playerId; this.resumeToken = message.resumeToken; this.roomCode = message.snapshot.roomId; localStorage.setItem(RESUME_TOKEN_KEY, message.resumeToken); localStorage.setItem(ROOM_CODE_KEY, message.snapshot.roomId); this.onState(message.snapshot, this.playerId); }
    else if (message.type === "ROOM_STATE") this.onState(message.snapshot, this.playerId);
    else if (message.type === "MOVE_ACK") { /* 로컬 이동은 공용 충돌 규칙으로 예측하고, 서버는 이후 모든 게임 판정을 권한적으로 검증한다. */ }
    else if (message.type === "KILL_COOLDOWN") useGameStore.getState().setKillCooldown(message.remainingMs);
    else if (message.type === "ROLE") useGameStore.getState().setRole(message.team, message.mafiaIds);
    else if (message.type === "ENVIRONMENT_STATE") useGameStore.getState().setEnvironment(message.environment);
    else if (message.type === "ROOM_CLOSED") { this.roomClosed = true; this.clearSavedSession(); useGameStore.setState({ room: undefined, playerId: undefined, role: undefined, mafiaIds: [], environment: undefined, networkError: message.message }); }
    else if (message.type === "ERROR") this.onError(message.message);
  }
  /** 열려 있는 연결일 때만 요청을 전송한다. */
  private send(message: ClientMessage): void { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message)); }
  /** 방이 사라졌을 때 자동 재접속을 막기 위해 로컬 정보를 정리한다. */
  private clearSavedSession(): void { this.roomCode = undefined; this.resumeToken = undefined; localStorage.removeItem(ROOM_CODE_KEY); localStorage.removeItem(RESUME_TOKEN_KEY); }
}
