import { GAME_CONFIG } from "./config";

export type MovementInput = { forward: boolean; backward: boolean; left: boolean; right: boolean; run: boolean };

/** 입력 상태를 정규화한 수평 이동 벡터로 바꾼다.
 * @param input 현재 키 입력 상태
 * @returns 대각선에서도 길이가 1 이하인 이동 벡터
 */
export function movementVector(input: MovementInput): { x: number; z: number } {
  const x = Number(input.right) - Number(input.left);
  const z = Number(input.backward) - Number(input.forward);
  const length = Math.hypot(x, z);
  return length > 1 ? { x: x / length, z: z / length } : { x, z };
}

/** 달리기 키 여부에 맞는 이동 속도를 반환한다.
 * @param running 달리기 입력 여부
 * @returns 초당 이동 거리
 */
export function movementSpeed(running: boolean): number {
  return running ? GAME_CONFIG.runSpeed : GAME_CONFIG.walkSpeed;
}
