import type { MovementInput } from "./movement";

/** 키 입력을 게임 이동 상태로 변환한다.
 * @param pressed 현재 눌린 키 집합
 * @returns 이동 처리에 사용할 입력 상태
 */
export function readMovementInput(pressed: Set<string>): MovementInput {
  return {
    forward: pressed.has("KeyW") || pressed.has("ArrowUp"),
    backward: pressed.has("KeyS") || pressed.has("ArrowDown"),
    left: pressed.has("KeyA") || pressed.has("ArrowLeft"),
    right: pressed.has("KeyD") || pressed.has("ArrowRight"),
    run: pressed.has("ShiftLeft") || pressed.has("ShiftRight"),
  };
}
