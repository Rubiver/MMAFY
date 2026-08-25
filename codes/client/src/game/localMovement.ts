import { BARRICADE_COLLIDER_SIZE, INTERACTION_COLLIDERS, PLAYER_COLLISION_RADIUS, SECURITY_SHUTTER_COLLIDER, WORLD_COLLIDERS, type BarricadeState, type Vector3Data } from "@mafia/shared";

/** 클라이언트 화면에서 서버와 같은 벽·장치 충돌을 적용한 수평 이동 결과를 계산한다.
 * @param position 현재 플레이어 위치
 * @param movement 이번 화면 프레임의 수평 이동량
 * @returns 충돌을 해소한 다음 위치
 */
export function resolveLocalMovement(position: Vector3Data, movement: { x: number; z: number }, shutterClosed = false, barricades: BarricadeState[] = []): Vector3Data {
  const candidate = { x: position.x + movement.x, y: position.y, z: position.z + movement.z };
  if (isWalkablePosition(candidate, shutterClosed, barricades)) return candidate;
  const xOnly = { x: candidate.x, y: position.y, z: position.z };
  if (isWalkablePosition(xOnly, shutterClosed, barricades)) return xOnly;
  const zOnly = { x: position.x, y: position.y, z: candidate.z };
  return isWalkablePosition(zOnly, shutterClosed, barricades) ? zOnly : position;
}

/** 플레이어 충돌 반지름이 벽, 장치, 바리케이드와 겹치지 않는지 확인한다.
 * @param position 확인할 참가자 중심 좌표
 * @param shutterClosed 셔터가 이동을 막는 상태인지 여부
 * @param barricades 서버가 승인한 활성 바리케이드 목록
 * @returns 참가자 충돌 반지름을 포함해 이동 가능한 좌표인지 여부
 */
export function isWalkablePosition(position: Vector3Data, shutterClosed: boolean, barricades: BarricadeState[]): boolean {
  return [...WORLD_COLLIDERS, ...INTERACTION_COLLIDERS, ...(shutterClosed ? [SECURITY_SHUTTER_COLLIDER] : []), ...barricades.map((barricade) => ({ id: barricade.id, position: barricade.position, size: BARRICADE_COLLIDER_SIZE }))].every((collider) => Math.abs(position.x - collider.position.x) > collider.size.x / 2 + PLAYER_COLLISION_RADIUS || Math.abs(position.z - collider.position.z) > collider.size.z / 2 + PLAYER_COLLISION_RADIUS);
}
