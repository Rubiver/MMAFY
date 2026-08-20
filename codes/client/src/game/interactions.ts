import type { InteractableState, Vector3Data } from "@mafia/shared";

/** 두 위치 사이의 수평 거리를 구한다.
 * @param from 시작 위치
 * @param to 대상 위치
 * @returns y축을 제외한 거리
 */
export function horizontalDistance(from: Vector3Data, to: Vector3Data): number {
  return Math.hypot(from.x - to.x, from.z - to.z);
}

/** 범위 안에서 가장 가까운 상호작용 대상을 찾는다.
 * @param position 플레이어 위치
 * @param devices 탐색할 장치 목록
 * @returns 상호작용 가능한 장치 또는 undefined
 */
export function findNearbyInteractable(position: Vector3Data, devices: InteractableState[]): InteractableState | undefined {
  return devices
    .filter((device) => device.currentState !== "OFFLINE" && horizontalDistance(position, device.position) <= device.interactionRange)
    .sort((first, second) => horizontalDistance(position, first.position) - horizontalDistance(position, second.position))[0];
}

/** 크로스헤어 방향과 상호작용 거리 안에 있는 장치를 찾는다.
 * @param position 플레이어 위치
 * @param direction 카메라가 바라보는 방향
 * @param devices 탐색할 장치 목록
 * @returns 조준한 장치 또는 undefined
 */
export function findCrosshairInteractable(position: Vector3Data, direction: Vector3Data, devices: InteractableState[]): InteractableState | undefined {
  return devices
    .filter((device) => device.currentState !== "OFFLINE" && horizontalDistance(position, device.position) <= device.interactionRange)
    .map((device) => ({ device, alignment: horizontalAlignment(position, direction, device.position) }))
    .filter(({ alignment }) => alignment >= 0.92)
    .sort((left, right) => right.alignment - left.alignment)[0]?.device;
}

/** 수평면에서 카메라 방향과 장치 방향의 일치도를 반환한다.
 * @param position 플레이어 위치
 * @param direction 카메라 방향
 * @param target 장치 위치
 * @returns -1부터 1 사이의 일치도
 */
function horizontalAlignment(position: Vector3Data, direction: Vector3Data, target: Vector3Data): number {
  const targetX = target.x - position.x; const targetZ = target.z - position.z;
  const targetLength = Math.hypot(targetX, targetZ); const directionLength = Math.hypot(direction.x, direction.z);
  if (targetLength === 0 || directionLength === 0) return -1;
  return (targetX * direction.x + targetZ * direction.z) / (targetLength * directionLength);
}
