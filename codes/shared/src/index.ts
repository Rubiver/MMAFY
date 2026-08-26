/** 3차원 공간의 직렬화 가능한 위치를 나타낸다. */
export type Vector3Data = { x: number; y: number; z: number };

/** 상호작용 장치의 화면 상태를 나타낸다. */
export type DeviceState = "READY" | "ACTIVE" | "OFFLINE";

/** 공통 상호작용 장치 모델이다. */
export type InteractableState = {
  id: string;
  name: string;
  type: "GENERATOR" | "DOOR" | "LADDER" | "VENT" | "BELL" | "TASK_PANEL" | "SECURITY_CARD" | "COOP_TASK" | "CCTV" | "COMMUNICATIONS" | "CARGO_PICKUP" | "CARGO_DELIVERY";
  position: Vector3Data;
  interactionRange: number;
  currentState: DeviceState;
};

/** 대기실과 게임 진행 단계 중 현재 상태를 나타낸다. */
export type GameState = "LOBBY" | "PLAYING" | "MEETING" | "VOTING" | "GAME_OVER";
export type RoleTeam = "SURVIVOR" | "MAFIA";
export type PlayerLifeState = "ALIVE" | "DEAD" | "GHOST";

/** 서버와 클라이언트가 함께 쓰는 처치와 신고 최대 거리다. */
export const KILL_RANGE = 2.4;
/** 서버와 클라이언트가 함께 쓰는 장치 상호작용 최대 거리다. */
export const INTERACTION_RANGE = 2.4;

/** 게임 시작 직후 마피아가 처치할 수 있을 때까지의 대기 시간이다. */
export const INITIAL_KILL_COOLDOWN_MS = 20_000;
/** 처치 성공 뒤 다음 처치까지의 대기 시간이다. */
export const KILL_COOLDOWN_MS = 25_000;
/** 신고 또는 긴급 회의에서 토론과 투표를 진행하는 제한 시간이다. */
export const MEETING_DURATION_MS = 90_000;
/** 서버와 클라이언트 예측 이동이 함께 쓰는 걷기 속도다. */
export const PLAYER_WALK_SPEED = 3.2;
/** 서버와 클라이언트 예측 이동이 함께 쓰는 달리기 속도다. */
export const PLAYER_RUN_SPEED = 5.4;
/** 플레이어가 벽과 장치에 접근할 수 있는 최소 반지름이다. */
export const PLAYER_COLLISION_RADIUS = 0.35;
/** 확장된 야외 맵의 가로 길이다. */
export const WORLD_WIDTH = 180;
/** 확장된 야외 맵의 세로 길이다. */
export const WORLD_DEPTH = 140;

/** 발전기 정전 때 시민 진영에 적용할 최대 시야 거리다. */
export const SURVIVOR_BLACKOUT_VIEW_DISTANCE = 4.5;

/** 시민이 발전기 복구 버튼을 유지해야 하는 최소 시간이다. */
export const REPAIR_HOLD_DURATION_MS = 3_000;
/** 시민 한 명이 한 판에서 설치할 수 있는 바리케이드 수다. */
export const BARRICADE_USES_PER_SURVIVOR = 1;
/** 설치된 바리케이드와 경보가 유지되는 시간이다. */
export const BARRICADE_DURATION_MS = 30_000;
/** 바리케이드가 차지하는 수평 충돌 크기다. */
export const BARRICADE_COLLIDER_SIZE: Vector3Data = { x: 2.8, y: 1.6, z: 2.8 };

/** 정전과 복구 대상으로 쓸 발전기 식별자다. */
export type GeneratorId = "generator-a" | "generator-b";
export type DoorState = "OPEN" | "CLOSED" | "LOCKED";
/** 서버가 공유하는 설치형 바리케이드 한 건이다. */
export type BarricadeState = { id: string; ownerId: string; position: Vector3Data; expiresAt: number };

/** 클라이언트 물리와 서버 이동 검증이 함께 쓰는 맵 충돌 상자다. */
export type WorldCollider = { id: string; position: Vector3Data; size: Vector3Data };

/** 발전기 복구와 화면 장치가 함께 쓰는 실제 발전기 위치다. */
export const GENERATOR_POSITIONS: Record<GeneratorId, Vector3Data> = { "generator-a": { x: -62, y: 0, z: -38 }, "generator-b": { x: 62, y: 0, z: 40 } };
/** 서쪽 숲과 동쪽 산업 지대를 잇는 마피아 전용 환풍구 입구다. */
export const VENT_ENTRANCE_POSITION: Vector3Data = { x: -76, y: 0, z: 42 };
/** 환풍구를 통과한 마피아가 도착하는 반대편 출구다. */
export const VENT_EXIT_POSITION: Vector3Data = { x: 76, y: 1.4, z: -42 };
/** 남쪽 중앙 교량에 놓인 긴급 회의 종의 위치다. */
export const EMERGENCY_BELL_POSITION: Vector3Data = { x: 0, y: 0, z: 27.5 };
/** 서쪽 숲 가장자리의 시민 공통 임무 회로 제어반 위치다. */
export const CIRCUIT_PANEL_POSITION: Vector3Data = { x: -48, y: 0, z: -12 };
/** 서쪽 숲 보급 상자의 물품 획득 위치다. */
export const CARGO_PICKUP_POSITION: Vector3Data = { x: -72, y: 0, z: 12 };
/** 동쪽 통신실 납품대의 물품 전달 위치다. */
export const CARGO_DELIVERY_POSITION: Vector3Data = { x: 42, y: 0, z: 42 };
/** 중앙 복도 보안 카드 인증 단말 위치다. */
export const SECURITY_CARD_POSITION: Vector3Data = { x: 18, y: 0, z: 18 };
/** 북쪽 중앙 교량에서 두 시민이 함께 작동할 동기화 단말 위치다. */
export const COOPERATIVE_TASK_POSITION: Vector3Data = { x: -5, y: 0, z: -27.5 };
/** 협동 임무에 두 시민이 함께 머물러야 하는 시간이다. */
export const COOPERATIVE_TASK_DURATION_MS = 5_000;
/** 시민이 두 발전기에서 과부하를 해제할 수 있는 제한 시간이다. */
export const CRITICAL_SABOTAGE_DURATION_MS = 60_000;
/** 서쪽 산장 출입구의 시민 개폐·마피아 잠금 셔터 위치다. */
export const SECURITY_SHUTTER_POSITION: Vector3Data = { x: -36, y: 0, z: -30 };
export const SECURITY_SHUTTER_COLLIDER: WorldCollider = { id: "security-shutter", position: { x: -36, y: 1.5, z: -30 }, size: { x: 0.5, y: 3, z: 3.2 } };
/** 동쪽 산업 지대 관제실 안쪽의 시민 전용 CCTV 조작대 위치다. */
export const CCTV_CONSOLE_POSITION: Vector3Data = { x: 50, y: 0, z: 30 };
/** 동쪽 산업 지대 통신실의 시민 복구 장치 위치다. */
export const COMMUNICATIONS_CONSOLE_POSITION: Vector3Data = { x: 58, y: 0, z: 42 };

/** 서쪽 숲, 강의 교량, 동쪽 산업 지대를 구성하는 서버 권한형 충돌 상자다. */
export const WORLD_COLLIDERS: readonly WorldCollider[] = [
  { id: "north-wall", position: { x: 0, y: 2.5, z: -70 }, size: { x: 180, y: 5, z: 0.5 } },
  { id: "south-wall", position: { x: 0, y: 2.5, z: 70 }, size: { x: 180, y: 5, z: 0.5 } },
  { id: "west-wall", position: { x: -90, y: 2.5, z: 0 }, size: { x: 0.5, y: 5, z: 140 } },
  { id: "east-wall", position: { x: 90, y: 2.5, z: 0 }, size: { x: 0.5, y: 5, z: 140 } },
  { id: "river-north", position: { x: 0, y: 1.5, z: -51 }, size: { x: 16, y: 3, z: 38 } },
  { id: "river-center", position: { x: 0, y: 1.5, z: 0 }, size: { x: 16, y: 3, z: 46 } },
  { id: "river-south", position: { x: 0, y: 1.5, z: 51 }, size: { x: 16, y: 3, z: 38 } },
  { id: "west-lodge-north", position: { x: -48, y: 2, z: -48 }, size: { x: 24, y: 4, z: 0.5 } },
  { id: "west-lodge-south", position: { x: -48, y: 2, z: -24 }, size: { x: 24, y: 4, z: 0.5 } },
  { id: "west-lodge-west", position: { x: -60, y: 2, z: -36 }, size: { x: 0.5, y: 4, z: 24 } },
  { id: "west-lodge-east", position: { x: -36, y: 2, z: -42 }, size: { x: 0.5, y: 4, z: 12 } },
  { id: "east-station-north", position: { x: 50, y: 2, z: 22 }, size: { x: 28, y: 4, z: 0.5 } },
  { id: "east-station-south", position: { x: 50, y: 2, z: 50 }, size: { x: 28, y: 4, z: 0.5 } },
  { id: "east-station-west", position: { x: 36, y: 2, z: 36 }, size: { x: 0.5, y: 4, z: 28 } },
  { id: "east-station-east", position: { x: 64, y: 2, z: 42 }, size: { x: 0.5, y: 4, z: 16 } },
];

/** 게임 시작 때 서버가 무작위로 배정하는 서로 겹치지 않는 참가자 스폰 위치다. */
export const PLAYER_SPAWN_POSITIONS: readonly Vector3Data[] = [
  { x: -76, y: 1.4, z: -58 }, { x: -62, y: 1.4, z: -58 }, { x: -48, y: 1.4, z: -58 }, { x: -28, y: 1.4, z: -58 }, { x: -18, y: 1.4, z: -28 },
  { x: -72, y: 1.4, z: -12 }, { x: -52, y: 1.4, z: -12 }, { x: -30, y: 1.4, z: -8 }, { x: -72, y: 1.4, z: 12 }, { x: -48, y: 1.4, z: 12 },
  { x: -26, y: 1.4, z: 26 }, { x: -76, y: 1.4, z: 54 }, { x: -56, y: 1.4, z: 54 }, { x: -34, y: 1.4, z: 54 }, { x: -18, y: 1.4, z: 30 },
  { x: 18, y: 1.4, z: -30 }, { x: 34, y: 1.4, z: -54 }, { x: 56, y: 1.4, z: -54 }, { x: 76, y: 1.4, z: -54 }, { x: 26, y: 1.4, z: -8 },
  { x: 48, y: 1.4, z: -8 }, { x: 72, y: 1.4, z: -8 }, { x: 20, y: 1.4, z: 30 }, { x: 72, y: 1.4, z: 58 }, { x: 30, y: 1.4, z: 58 },
];

/** 서쪽 숲에 배치할 나무 중심 위치다. 줄기에는 서버와 클라이언트가 같은 충돌을 적용한다. */
export const TREE_POSITIONS: readonly Vector3Data[] = [
  { x: -78, y: 0, z: -42 }, { x: -72, y: 0, z: -28 }, { x: -66, y: 0, z: 24 }, { x: -76, y: 0, z: 34 }, { x: -62, y: 0, z: 44 },
  { x: -52, y: 0, z: 32 }, { x: -42, y: 0, z: 42 }, { x: -34, y: 0, z: 18 }, { x: -30, y: 0, z: -18 }, { x: -76, y: 0, z: 4 },
  { x: -54, y: 0, z: 2 }, { x: -38, y: 0, z: 4 }, { x: 30, y: 0, z: -26 }, { x: 46, y: 0, z: -18 }, { x: 72, y: 0, z: 12 },
];

/** 장치 외형과 동일하게 서버 이동도 막아야 하는 충돌 상자다. */
export const INTERACTION_COLLIDERS: readonly WorldCollider[] = [
  { id: "generator-a", position: { x: GENERATOR_POSITIONS["generator-a"].x, y: 0.65, z: GENERATOR_POSITIONS["generator-a"].z }, size: { x: 1.1, y: 1.3, z: 0.8 } },
  { id: "generator-b", position: { x: GENERATOR_POSITIONS["generator-b"].x, y: 0.65, z: GENERATOR_POSITIONS["generator-b"].z }, size: { x: 1.1, y: 1.3, z: 0.8 } },
  { id: "maintenance-ladder", position: { x: 72, y: 1.4, z: -36 }, size: { x: 0.45, y: 2.8, z: 0.2 } },
  { id: "cooperative-task", position: { x: COOPERATIVE_TASK_POSITION.x, y: 0.8, z: COOPERATIVE_TASK_POSITION.z }, size: { x: 1.4, y: 1.6, z: 0.8 } },
  ...TREE_POSITIONS.map((position, index) => ({ id: `tree-${index + 1}`, position: { x: position.x, y: 1.8, z: position.z }, size: { x: 1.1, y: 3.6, z: 1.1 } })),
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

/** 회의 중 서버가 모든 참가자에게 전파하는 채팅 한 건이다. */
export type MeetingChatMessage = { id: string; playerId: string; displayName: string; text: string; sentAt: number };
/** 회의 종료 직전에 모든 참가자에게 보여 줄 서버 확정 결과다. */
export type MeetingResult = { type: "SKIP" | "EXPEL"; expelledId?: string; endsAt: number };

/** 신고 또는 긴급 회의의 서버 권한 상태다. */
export type MeetingState = { reporterId: string; bodyId?: string; votes: Record<string, string | "SKIP">; endsAt: number; messages: MeetingChatMessage[] };

/** 대기실 화면에 필요한 서버 권한 상태다. */
export type RoomSnapshot = {
  roomId: string;
  hostId: string;
  gameState: GameState;
  maxPlayers: number;
  players: NetworkPlayer[];
  meeting?: MeetingState;
  meetingResult?: MeetingResult;
  result?: { winner: RoleTeam; expelledId?: string };
};

/** 클라이언트가 서버로 보낼 수 있는 요청이다. */
export type ClientMessage =
  | { type: "CREATE_ROOM"; displayName: string }
  | { type: "JOIN"; displayName: string; roomCode: string; resumeToken?: string }
  | { type: "SET_READY"; ready: boolean }
  | { type: "DELETE_ROOM" }
  | { type: "RESET_GAME" }
  | { type: "START_GAME" }
  | { type: "SET_MAFIA_COUNT"; count: number }
  | { type: "KILL"; targetId: string }
  | { type: "REPORT"; bodyId: string }
  | { type: "CALL_MEETING" }
  | { type: "START_VOTING" }
  | { type: "VOTE"; targetId: string | "SKIP" }
  | { type: "CHAT"; text: string }
  | { type: "ENVIRONMENT"; action: "SABOTAGE" | "CRITICAL_SABOTAGE" | "CRITICAL_REPAIR" | "REPAIR_START" | "REPAIR_COMPLETE" | "REPAIR_CANCEL" | "VENT" | "TASK" | "SECURITY_CARD_TASK" | "COOP_TASK_START" | "COOP_TASK_CANCEL" | "DOOR_TOGGLE" | "DOOR_LOCK" | "CCTV_OPEN" | "CCTV_CLOSE" | "COMM_SABOTAGE" | "COMM_REPAIR" | "BARRICADE_DEPLOY" | "BARRICADE_DISMANTLE" | "CARGO_PICKUP" | "CARGO_DELIVER"; deviceId?: GeneratorId; puzzle?: string[] }
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
  | { type: "ROOM_CLOSED"; message: string }
  | { type: "ERROR"; code: "ROOM_FULL" | "INVALID_MESSAGE" | "NOT_HOST" | "NOT_READY" | "GAME_STARTED"; message: string }
  | { type: "PONG" };

/** 서버가 동기화하는 환경 장치 상태다. */
export type EnvironmentState = { blackout: boolean; generatorOnline: boolean; generators: Record<GeneratorId, boolean>; cctvOnline: boolean; communicationsOnline: boolean; doorLocked: boolean; doorState: DoorState; taskProgress: number; alarmActive: boolean; barricades: BarricadeState[]; cargoCarrierIds: string[]; cargoCompletedIds: string[]; securityCardCompletedIds: string[]; cooperativeParticipantIds: string[]; cooperativeProgress: number; cooperativeCompleted: boolean; criticalSabotageEndsAt?: number; criticalRepairedGeneratorIds: GeneratorId[] };
