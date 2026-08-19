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
