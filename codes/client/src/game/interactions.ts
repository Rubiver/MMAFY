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
