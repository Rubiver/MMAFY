import type { ClientMessage, RoomSnapshot, ServerMessage } from "@mafia/shared";
import { useGameStore } from "../store/gameStore";

type Listener = (snapshot: RoomSnapshot, playerId: string) => void;
type ErrorListener = (message: string) => void;
let activeClient: GameClient | undefined;

/** 현재 게임 화면이 사용할 연결 객체를 등록한다. */
export function setActiveGameClient(client: GameClient): void { activeClient = client; }

/** 현재 활성화된 게임 연결 객체를 반환한다. */
export function getActiveGameClient(): GameClient | undefined { return activeClient; }

/** 로컬 개발 서버와 WebSocket 연결을 관리한다. */
export class GameClient {
  private socket?: WebSocket;
  private playerId = "";
  private resumeToken = localStorage.getItem("mafia-resume-token") ?? undefined;
  private snapshot?: RoomSnapshot;

  /** @param onState 서버 상태 수신 처리기 @param onError 오류 표시 처리기 */
  constructor(private readonly onState: Listener, private readonly onError: ErrorListener) {}

  /** 서버에 연결하고 대기실 입장 요청을 전송한다. */
  connect(displayName: string): void {
    this.socket?.close();
    this.socket = new WebSocket(import.meta.env.VITE_GAME_SERVER_URL ?? "ws://localhost:2567");
    this.socket.addEventListener("open", () => this.send({ type: "JOIN", displayName, resumeToken: this.resumeToken }));
    this.socket.addEventListener("message", (event) => this.handleMessage(JSON.parse(String(event.data)) as ServerMessage));
    this.socket.addEventListener("close", () => this.onError("서버 연결이 끊겼습니다. 다시 연결해 주세요."));
    this.socket.addEventListener("error", () => this.onError("게임 서버에 연결할 수 없습니다. 서버를 먼저 실행해 주세요."));
  }

  /** 준비 상태 변경을 서버에 요청한다. */
  setReady(ready: boolean): void { this.send({ type: "SET_READY", ready }); }

  /** 방장 권한으로 게임 시작을 요청한다. */
  startGame(): void { this.send({ type: "START_GAME" }); }
  setMafiaCount(count: number): void { this.send({ type: "SET_MAFIA_COUNT", count }); }
  kill(targetId: string): void { this.send({ type: "KILL", targetId }); }
  callMeeting(): void { this.send({ type: "CALL_MEETING" }); }
  startVoting(): void { this.send({ type: "START_VOTING" }); }
  vote(targetId: string | "SKIP"): void { this.send({ type: "VOTE", targetId }); }
  environment(action: "SABOTAGE" | "REPAIR" | "VENT" | "TASK"): void { this.send({ type: "ENVIRONMENT", action }); }

  /** 초당 최대 15회 이동 입력을 서버로 전달한다. */
  move(direction: { x: number; z: number }, rotation: number, sequence: number): void { this.send({ type: "MOVE", direction, rotation, sequence }); }

  /** 가장 최근의 권한형 상태를 반환한다. */
  getSnapshot(): RoomSnapshot | undefined { return this.snapshot; }

  /** 현재 연결된 내 참가자 식별자를 반환한다. */
  getPlayerId(): string { return this.playerId; }

  /** 서버 메시지 종류별로 로컬 상태를 갱신한다. */
  private handleMessage(message: ServerMessage): void {
    if (message.type === "WELCOME") {
      this.playerId = message.playerId;
      this.resumeToken = message.resumeToken;
      localStorage.setItem("mafia-resume-token", message.resumeToken);
      this.snapshot = message.snapshot;
      this.onState(message.snapshot, this.playerId);
    } else if (message.type === "ROOM_STATE") {
      this.snapshot = message.snapshot;
      this.onState(message.snapshot, this.playerId);
    } else if (message.type === "ROLE") useGameStore.getState().setRole(message.team);
    else if (message.type === "ENVIRONMENT_STATE") useGameStore.getState().setEnvironment(message.environment);
    else if (message.type === "ERROR") this.onError(message.message);
  }

  /** 열려 있는 연결일 때만 요청을 보낸다. */
  private send(message: ClientMessage): void { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message)); }
}
