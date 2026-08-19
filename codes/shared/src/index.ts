/** 3차원 공간의 직렬화 가능한 위치를 나타낸다. */
export type Vector3Data = { x: number; y: number; z: number };

/** 상호작용 장치의 화면 상태를 나타낸다. */
export type DeviceState = "READY" | "ACTIVE" | "OFFLINE";

/** 공통 상호작용 장치 모델이다. */
export type InteractableState = {
  id: string;
  name: string;
  type: "GENERATOR" | "DOOR" | "LADDER";
  position: Vector3Data;
  interactionRange: number;
  currentState: DeviceState;
};

/** 대기실과 게임 진행 단계 중 현재 상태를 나타낸다. */
export type GameState = "LOBBY" | "PLAYING" | "MEETING" | "VOTING" | "GAME_OVER";
export type RoleTeam = "SURVIVOR" | "MAFIA";
export type PlayerLifeState = "ALIVE" | "DEAD" | "GHOST";

/** 네트워크로 공유하는 참가자 상태다. */
export type NetworkPlayer = {
  id: string;
  displayName: string;
  position: Vector3Data;
  rotation: number;
  ready: boolean;
  connected: boolean;
  lifeState: PlayerLifeState;
  bodyId?: string;
};

/** 대기실 화면에 필요한 서버 권한 상태다. */
export type RoomSnapshot = {
  roomId: string;
  hostId: string;
  gameState: GameState;
  maxPlayers: number;
  players: NetworkPlayer[];
  meeting?: { reporterId: string; bodyId?: string; votes: Record<string, string | "SKIP"> };
  result?: { winner: RoleTeam; expelledId?: string };
};

/** 클라이언트가 서버로 보낼 수 있는 요청이다. */
export type ClientMessage =
  | { type: "JOIN"; displayName: string; resumeToken?: string }
  | { type: "SET_READY"; ready: boolean }
  | { type: "START_GAME" }
  | { type: "SET_MAFIA_COUNT"; count: number }
  | { type: "KILL"; targetId: string }
  | { type: "REPORT"; bodyId: string }
  | { type: "CALL_MEETING" }
  | { type: "START_VOTING" }
  | { type: "VOTE"; targetId: string | "SKIP" }
  | { type: "MOVE"; direction: { x: number; z: number }; rotation: number; sequence: number }
  | { type: "PING" };

/** 서버가 클라이언트에 보내는 응답이다. */
export type ServerMessage =
  | { type: "WELCOME"; playerId: string; resumeToken: string; snapshot: RoomSnapshot }
  | { type: "ROOM_STATE"; snapshot: RoomSnapshot }
  | { type: "ROLE"; team: RoleTeam; mafiaIds: string[] }
  | { type: "ERROR"; code: "ROOM_FULL" | "INVALID_MESSAGE" | "NOT_HOST" | "NOT_READY" | "GAME_STARTED"; message: string }
  | { type: "PONG" };
