import { KILL_RANGE, type InteractableState, type NetworkPlayer, type RoleTeam, type Vector3Data } from "@mafia/shared";

export type PrimaryAction = { type: "REPORT"; bodyId: string } | { type: "KILL"; targetId: string } | undefined;

/** 신고 우선 규칙과 처치 대상 대체 규칙에 따라 기본 행동 요청을 정한다. */
export function findPrimaryAction(nearbyBodyId: string | undefined, role: RoleTeam | undefined, aimedKillTargetId: string | undefined, killTargetIds: string[]): PrimaryAction {
  if (nearbyBodyId) return { type: "REPORT", bodyId: nearbyBodyId };
  const targetId = aimedKillTargetId ?? killTargetIds[0];
  return role === "MAFIA" && targetId ? { type: "KILL", targetId } : undefined;
}

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

/** 처치 거리 안에서 크로스헤어 수평 방향에 가장 잘 맞는 살아 있는 시민을 찾는다.
 * @param position 마피아의 현재 위치
 * @param direction 카메라가 바라보는 방향
 * @param players 서버가 동기화한 참가자 목록
 * @param mafiaIds 마피아 진영 참가자 식별자 목록
 * @returns 처치 요청에 쓸 시민 또는 undefined
 */
export function findCrosshairKillTarget(position: Vector3Data, direction: Vector3Data, players: NetworkPlayer[], mafiaIds: string[]): NetworkPlayer | undefined {
  return findNearbyKillTargets(position, players, mafiaIds)
    .map((player) => ({ player, alignment: horizontalAlignment(position, direction, player.position), distance: horizontalDistance(position, player.position) }))
    .filter(({ alignment }) => alignment >= 0.7)
    .sort((left, right) => right.alignment - left.alignment || left.distance - right.distance)[0]?.player;
}

/** 처치 거리 안의 살아 있는 시민을 가까운 순서로 반환한다.
 * @param position 마피아의 현재 위치
 * @param players 서버가 동기화한 참가자 목록
 * @param mafiaIds 마피아 진영 참가자 식별자 목록
 * @returns 처치 요청에 쓸 수 있는 시민 목록
 */
export function findNearbyKillTargets(position: Vector3Data, players: NetworkPlayer[], mafiaIds: string[]): NetworkPlayer[] {
  return players
    .filter((player) => player.lifeState === "ALIVE" && !mafiaIds.includes(player.id) && horizontalDistance(position, player.position) <= KILL_RANGE)
    .sort((left, right) => horizontalDistance(position, left.position) - horizontalDistance(position, right.position) || left.id.localeCompare(right.id));
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
