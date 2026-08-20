import { INTERACTION_COLLIDERS, PLAYER_COLLISION_RADIUS, WORLD_COLLIDERS, type Vector3Data } from "@mafia/shared";

/** 클라이언트 화면에서 서버와 같은 벽·장치 충돌을 적용한 수평 이동 결과를 계산한다.
 * @param position 현재 플레이어 위치
 * @param movement 이번 화면 프레임의 수평 이동량
 * @returns 충돌을 해소한 다음 위치
 */
export function resolveLocalMovement(position: Vector3Data, movement: { x: number; z: number }): Vector3Data {
  const candidate = { x: position.x + movement.x, y: position.y, z: position.z + movement.z };
  if (isWalkable(candidate)) return candidate;
  const xOnly = { x: candidate.x, y: position.y, z: position.z };
  if (isWalkable(xOnly)) return xOnly;
  const zOnly = { x: position.x, y: position.y, z: candidate.z };
  return isWalkable(zOnly) ? zOnly : position;
}

/** 플레이어 충돌 반지름이 벽 또는 장치 충돌 상자와 겹치지 않는지 확인한다. */
function isWalkable(position: Vector3Data): boolean {
  return [...WORLD_COLLIDERS, ...INTERACTION_COLLIDERS].every((collider) => Math.abs(position.x - collider.position.x) > collider.size.x / 2 + PLAYER_COLLISION_RADIUS || Math.abs(position.z - collider.position.z) > collider.size.z / 2 + PLAYER_COLLISION_RADIUS);
}
