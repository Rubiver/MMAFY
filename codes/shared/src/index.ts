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

/** 서버와 클라이언트가 함께 쓰는 마피아 처치 최대 거리다. */
export const KILL_RANGE = 2;

/** 게임 시작 직후 마피아가 처치할 수 있을 때까지의 대기 시간이다. */
export const INITIAL_KILL_COOLDOWN_MS = 20_000;
/** 처치 성공 뒤 다음 처치까지의 대기 시간이다. */
export const KILL_COOLDOWN_MS = 25_000;
/** 서버와 클라이언트 예측 이동이 함께 쓰는 걷기 속도다. */
export const PLAYER_WALK_SPEED = 3.2;
/** 서버와 클라이언트 예측 이동이 함께 쓰는 달리기 속도다. */
export const PLAYER_RUN_SPEED = 5.4;
/** 플레이어가 벽과 장치에 접근할 수 있는 최소 반지름이다. */
export const PLAYER_COLLISION_RADIUS = 0.35;

/** 발전기 정전 때 시민 진영에 적용할 최대 시야 거리다. */
export const SURVIVOR_BLACKOUT_VIEW_DISTANCE = 4.5;

/** 시민이 발전기 복구 버튼을 유지해야 하는 최소 시간이다. */
export const REPAIR_HOLD_DURATION_MS = 3_000;

/** 정전과 복구 대상으로 쓸 발전기 식별자다. */
export type GeneratorId = "generator-a" | "generator-b";

/** 클라이언트 물리와 서버 이동 검증이 함께 쓰는 맵 충돌 상자다. */
export type WorldCollider = { id: string; position: Vector3Data; size: Vector3Data };

/** 중앙 복도와 좌우 방으로 구성한 단층 주택의 벽 충돌 상자 목록이다. 출입구는 빈 공간으로 둔다. */
export const WORLD_COLLIDERS: readonly WorldCollider[] = [
  { id: "north-wall", position: { x: 0, y: 1.5, z: -14 }, size: { x: 36, y: 3, z: 0.35 } },
  { id: "south-wall", position: { x: 0, y: 1.5, z: 14 }, size: { x: 36, y: 3, z: 0.35 } },
  { id: "west-wall", position: { x: -18, y: 1.5, z: 0 }, size: { x: 0.35, y: 3, z: 28 } },
  { id: "east-wall", position: { x: 18, y: 1.5, z: 0 }, size: { x: 0.35, y: 3, z: 28 } },
  { id: "left-hall-north-wall", position: { x: -5, y: 1.5, z: -8 }, size: { x: 0.35, y: 3, z: 8 } },
  { id: "left-hall-south-wall", position: { x: -5, y: 1.5, z: 6 }, size: { x: 0.35, y: 3, z: 10 } },
  { id: "right-hall-north-wall", position: { x: 5, y: 1.5, z: -8 }, size: { x: 0.35, y: 3, z: 8 } },
  { id: "right-hall-south-wall", position: { x: 5, y: 1.5, z: 6 }, size: { x: 0.35, y: 3, z: 10 } },
  { id: "west-upper-room-wall-a", position: { x: -14, y: 1.5, z: -3 }, size: { x: 6, y: 3, z: 0.35 } },
  { id: "west-upper-room-wall-b", position: { x: -7.5, y: 1.5, z: -3 }, size: { x: 3, y: 3, z: 0.35 } },
  { id: "east-upper-room-wall-a", position: { x: 14, y: 1.5, z: -3 }, size: { x: 6, y: 3, z: 0.35 } },
  { id: "east-upper-room-wall-b", position: { x: 7.5, y: 1.5, z: -3 }, size: { x: 3, y: 3, z: 0.35 } },
  { id: "west-lower-room-wall-a", position: { x: -14, y: 1.5, z: 4 }, size: { x: 6, y: 3, z: 0.35 } },
  { id: "west-lower-room-wall-b", position: { x: -7.5, y: 1.5, z: 4 }, size: { x: 3, y: 3, z: 0.35 } },
  { id: "east-lower-room-wall-a", position: { x: 14, y: 1.5, z: 4 }, size: { x: 6, y: 3, z: 0.35 } },
  { id: "east-lower-room-wall-b", position: { x: 7.5, y: 1.5, z: 4 }, size: { x: 3, y: 3, z: 0.35 } },
];

/** 게임 시작 때 서버가 무작위로 배정하는 서로 겹치지 않는 참가자 스폰 위치다. */
export const PLAYER_SPAWN_POSITIONS: readonly Vector3Data[] = [
  { x: -2, y: 1.4, z: -10 }, { x: 0, y: 1.4, z: -10 }, { x: 2, y: 1.4, z: -10 }, { x: -2, y: 1.4, z: -5 }, { x: 0, y: 1.4, z: -5 },
  { x: 2, y: 1.4, z: -5 }, { x: -2, y: 1.4, z: 0 }, { x: 0, y: 1.4, z: 0 }, { x: 2, y: 1.4, z: 0 }, { x: -2, y: 1.4, z: 5 },
  { x: 0, y: 1.4, z: 5 }, { x: 2, y: 1.4, z: 5 }, { x: -2, y: 1.4, z: 10 }, { x: 0, y: 1.4, z: 10 }, { x: 2, y: 1.4, z: 10 },
  { x: -12, y: 1.4, z: -10 }, { x: 12, y: 1.4, z: -10 }, { x: -12, y: 1.4, z: -6 }, { x: 12, y: 1.4, z: -6 }, { x: -12, y: 1.4, z: 0 },
  { x: 12, y: 1.4, z: 0 }, { x: -12, y: 1.4, z: 6 }, { x: 12, y: 1.4, z: 6 }, { x: -12, y: 1.4, z: 10 }, { x: 12, y: 1.4, z: 10 },
];

/** 장치 외형과 동일하게 서버 이동도 막아야 하는 충돌 상자다. */
export const INTERACTION_COLLIDERS: readonly WorldCollider[] = [
  { id: "generator-a", position: { x: -12, y: 0.65, z: -8 }, size: { x: 1.1, y: 1.3, z: 0.8 } },
  { id: "generator-b", position: { x: 12, y: 0.65, z: 8 }, size: { x: 1.1, y: 1.3, z: 0.8 } },
  { id: "maintenance-ladder", position: { x: 12, y: 1.4, z: -8 }, size: { x: 0.45, y: 2.8, z: 0.2 } },
];

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
  | { type: "CREATE_ROOM"; displayName: string }
  | { type: "JOIN"; displayName: string; roomCode: string; resumeToken?: string }
  | { type: "SET_READY"; ready: boolean }
  | { type: "START_GAME" }
  | { type: "SET_MAFIA_COUNT"; count: number }
  | { type: "KILL"; targetId: string }
  | { type: "REPORT"; bodyId: string }
  | { type: "CALL_MEETING" }
  | { type: "START_VOTING" }
  | { type: "VOTE"; targetId: string | "SKIP" }
  | { type: "ENVIRONMENT"; action: "SABOTAGE" | "REPAIR_START" | "REPAIR_COMPLETE" | "REPAIR_CANCEL" | "VENT" | "TASK"; deviceId?: GeneratorId }
  | { type: "MOVE"; direction: { x: number; z: number }; rotation: number; run: boolean; sequence: number }
  | { type: "PING" };

/** 서버가 클라이언트에 보내는 응답이다. */
export type ServerMessage =
  | { type: "WELCOME"; playerId: string; resumeToken: string; snapshot: RoomSnapshot }
  | { type: "ROOM_STATE"; snapshot: RoomSnapshot }
  | { type: "MOVE_ACK"; sequence: number; position: Vector3Data }
  | { type: "KILL_COOLDOWN"; remainingMs: number }
  | { type: "ROLE"; team: RoleTeam; mafiaIds: string[] }
  | { type: "ENVIRONMENT_STATE"; environment: EnvironmentState }
  | { type: "ERROR"; code: "ROOM_FULL" | "INVALID_MESSAGE" | "NOT_HOST" | "NOT_READY" | "GAME_STARTED"; message: string }
  | { type: "PONG" };

/** 서버가 동기화하는 환경 장치 상태다. */
export type EnvironmentState = { blackout: boolean; generatorOnline: boolean; generators: Record<GeneratorId, boolean>; cctvOnline: boolean; doorLocked: boolean; taskProgress: number };
