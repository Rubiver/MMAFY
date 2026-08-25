/** 개발 서버에서만 반복 테스트 시간을 줄이는 이동 속도 배율이다. */
const DEVELOPMENT_MOVEMENT_SPEED_MULTIPLIER = import.meta.env.DEV ? 3 : 1;

import { INTERACTION_RANGE } from "@mafia/shared";

/** 이동 속도와 상호작용 거리를 한곳에서 관리한다. */
export const GAME_CONFIG = {
  walkSpeed: 3.2 * DEVELOPMENT_MOVEMENT_SPEED_MULTIPLIER,
  runSpeed: 5.4 * DEVELOPMENT_MOVEMENT_SPEED_MULTIPLIER,
  interactionRange: INTERACTION_RANGE,
  playerHeight: 0.9,
} as const;
