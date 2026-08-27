import { BARRICADE_DURATION_MS, BARRICADE_USES_PER_SURVIVOR, CARGO_DELIVERY_POSITION, CARGO_PICKUP_POSITION, COOLANT_MIXER_POSITION, CRITICAL_SABOTAGE_DURATION_MS, CCTV_CONSOLE_POSITION, CIRCUIT_PANEL_POSITION, COMMUNICATIONS_CONSOLE_POSITION, COOPERATIVE_TASK_DURATION_MS, COOPERATIVE_TASK_POSITION, DATA_SORTER_POSITION, GENERATOR_POSITIONS, INTERACTION_RANGE, REPAIR_HOLD_DURATION_MS, SECURITY_CARD_POSITION, SECURITY_SHUTTER_POSITION, VENT_ENTRANCE_POSITION, VENT_EXIT_POSITION, type EnvironmentState, type GeneratorId, type RoleTeam, type Vector3Data } from "@mafia/shared";
const INITIAL_STATE: EnvironmentState = { blackout: false, generatorOnline: true, generators: { "generator-a": true, "generator-b": true }, cctvOnline: true, communicationsOnline: true, doorLocked: false, doorState: "OPEN", taskProgress: 0, alarmActive: false, barricades: [], cargoCarrierIds: [], cargoCompletedIds: [], securityCardCompletedIds: [], dataSortCompletedIds: [], coolantCompletedIds: [], cooperativeParticipantIds: [], cooperativeProgress: 0, cooperativeCompleted: false, criticalSabotageEndsAt: undefined, criticalRepairedGeneratorIds: [] };
const CIRCUIT_ORDER = ["AMBER", "CYAN", "VIOLET"] as const;
const SECURITY_CARD_PATTERN = ["LEFT", "UP", "RIGHT", "DOWN"] as const;
const DATA_SORT_ORDER = ["2", "4", "7", "9"] as const;
const COOLANT_TARGET = ["30", "50", "20"] as const;

/** 환경 장치의 거리, 역할, 쿨타임을 서버에서 검증한다. */
export class EnvironmentSystem {
  private state: EnvironmentState = { ...INITIAL_STATE, generators: { ...INITIAL_STATE.generators } };
  private readonly cooldowns = new Map<string, number>();
  private readonly repairStarts = new Map<string, number>();
  private readonly completedCircuitPlayers = new Set<string>();
  private readonly cctvOperators = new Set<string>();
  private readonly barricadeUsers = new Set<string>();
  private readonly cargoCarriers = new Set<string>();
  private readonly cargoCompletedPlayers = new Set<string>();
  private readonly securityCardCompletedPlayers = new Set<string>();
  private readonly dataSortCompletedPlayers = new Set<string>();
  private readonly coolantCompletedPlayers = new Set<string>();
  private readonly cooperativeParticipants = new Set<string>();
  private cooperativeActiveSince?: number;
  private readonly criticalRepairedGenerators = new Set<GeneratorId>();

  /** 현재 환경 상태의 복사본을 반환한다. */
  snapshot(): EnvironmentState { return { ...this.state, generators: { ...this.state.generators }, barricades: this.state.barricades.map((barricade) => ({ ...barricade, position: { ...barricade.position } })), cargoCarrierIds: [...this.cargoCarriers], cargoCompletedIds: [...this.cargoCompletedPlayers], securityCardCompletedIds: [...this.securityCardCompletedPlayers], dataSortCompletedIds: [...this.dataSortCompletedPlayers], coolantCompletedIds: [...this.coolantCompletedPlayers], cooperativeParticipantIds: [...this.cooperativeParticipants], criticalRepairedGeneratorIds: [...this.criticalRepairedGenerators] }; }
  /** 새 게임 시작 전에 모든 장치를 정상 상태로 되돌린다. */
  reset(): void { this.state = { ...INITIAL_STATE, generators: { ...INITIAL_STATE.generators }, barricades: [], cargoCarrierIds: [], cargoCompletedIds: [], securityCardCompletedIds: [], dataSortCompletedIds: [], coolantCompletedIds: [], cooperativeParticipantIds: [], criticalRepairedGeneratorIds: [] }; this.cooldowns.clear(); this.repairStarts.clear(); this.completedCircuitPlayers.clear(); this.cctvOperators.clear(); this.barricadeUsers.clear(); this.cargoCarriers.clear(); this.cargoCompletedPlayers.clear(); this.securityCardCompletedPlayers.clear(); this.dataSortCompletedPlayers.clear(); this.coolantCompletedPlayers.clear(); this.cooperativeParticipants.clear(); this.cooperativeActiveSince = undefined; this.criticalRepairedGenerators.clear(); }
  /** 마피아만 원격으로 지정한 발전기를 고장 내 정전을 시작할 수 있다. */
  sabotage(playerId: string, team: RoleTeam, generatorId: GeneratorId, now: number): void { this.require(team === "MAFIA" && !this.state.blackout && this.state.generators[generatorId] && this.ready(playerId, now), "정전 조건을 만족하지 않습니다."); this.state.blackout = true; this.state.generatorOnline = false; this.state.generators[generatorId] = false; this.state.cctvOnline = false; this.cctvOperators.clear(); this.clearCooperativeTask(); }
  /** 마피아가 두 발전기를 동시에 멈추고 제한 시간 긴급 과부하를 시작한다. */
  sabotageCritical(playerId: string, team: RoleTeam, now: number): void {
    this.require(team === "MAFIA" && !this.state.blackout && this.state.criticalSabotageEndsAt === undefined && this.ready(playerId, now), "핵심 전력 과부하 조건을 만족하지 않습니다.");
    this.state.criticalSabotageEndsAt = now + CRITICAL_SABOTAGE_DURATION_MS;
    this.state.generatorOnline = false;
    this.state.generators = { "generator-a": false, "generator-b": false };
    this.state.cctvOnline = false;
    this.cctvOperators.clear();
    this.criticalRepairedGenerators.clear();
    this.clearCooperativeTask();
  }
  /** 시민이 가까운 발전기의 긴급 초기화 스위치를 복구한다.
   * @returns 두 발전기를 모두 복구해 과부하를 해제했는지 여부
   */
  repairCritical(team: RoleTeam, generatorId: GeneratorId, position: Vector3Data): boolean {
    this.require(team === "SURVIVOR" && this.state.criticalSabotageEndsAt !== undefined && !this.criticalRepairedGenerators.has(generatorId) && near(position, GENERATOR_POSITIONS[generatorId]), "긴급 과부하 복구 조건을 만족하지 않습니다.");
    this.criticalRepairedGenerators.add(generatorId);
    this.state.generators[generatorId] = true;
    if (this.criticalRepairedGenerators.size < 2) return false;
    this.state.criticalSabotageEndsAt = undefined;
    this.state.generatorOnline = true;
    this.state.generators = { "generator-a": true, "generator-b": true };
    this.state.blackout = false;
    this.state.cctvOnline = this.state.communicationsOnline;
    this.criticalRepairedGenerators.clear();
    return true;
  }
  /** 제한 시간이 끝났는지 확인해 마피아 승리 요청을 반환한다. */
  advanceCriticalSabotage(now: number): { changed: boolean; mafiaWon: boolean } {
    if (this.state.criticalSabotageEndsAt === undefined || now < this.state.criticalSabotageEndsAt) return { changed: false, mafiaWon: false };
    this.state.criticalSabotageEndsAt = undefined;
    return { changed: true, mafiaWon: true };
  }
  /** 시민이 발전기 근처에서 복구 버튼 유지를 시작한다. */
  startRepair(playerId: string, team: RoleTeam, generatorId: GeneratorId, position: Vector3Data, now: number): void { this.require(team === "SURVIVOR" && this.state.blackout && !this.state.generators[generatorId] && near(position, GENERATOR_POSITIONS[generatorId]), "복구 시작 조건을 만족하지 않습니다."); this.repairStarts.set(playerId, now); }
  /** 시민이 3초간 복구 버튼을 유지했는지 확인하고 정전을 해제한다. */
  completeRepair(playerId: string, team: RoleTeam, generatorId: GeneratorId, position: Vector3Data, now: number): void { const startedAt = this.repairStarts.get(playerId); this.require(team === "SURVIVOR" && this.state.blackout && !this.state.generators[generatorId] && startedAt !== undefined && now - startedAt >= REPAIR_HOLD_DURATION_MS && near(position, GENERATOR_POSITIONS[generatorId]), "복구 조건을 만족하지 않습니다."); this.repairStarts.delete(playerId); this.state.generators[generatorId] = true; this.state.blackout = false; this.state.generatorOnline = true; this.state.cctvOnline = this.state.communicationsOnline; }
  /** 버튼을 놓거나 취소한 시민의 복구 진행 상태를 제거한다. */
  cancelRepair(playerId: string): void { this.repairStarts.delete(playerId); }
  /** 마피아가 양쪽 환풍구 입구 중 가까운 쪽에서 반대편 출구로 이동한다. */
  useVent(team: RoleTeam, position: Vector3Data): Vector3Data {
    this.require(team === "MAFIA", "환풍구는 마피아만 사용할 수 있습니다.");
    if (near(position, VENT_ENTRANCE_POSITION)) return { ...VENT_EXIT_POSITION };
    if (near(position, VENT_EXIT_POSITION)) return { ...VENT_ENTRANCE_POSITION, y: VENT_EXIT_POSITION.y };
    throw new Error("환풍구 권한 또는 거리가 올바르지 않습니다.");
  }
  /** 시민이 셔터 가까이에서 열고 닫게 한다. */
  toggleDoor(team: RoleTeam, position: Vector3Data): void { this.require(team === "SURVIVOR" && near(position, SECURITY_SHUTTER_POSITION) && this.state.doorState !== "LOCKED", "셔터 개폐 조건을 만족하지 않습니다."); this.state.doorState = this.state.doorState === "OPEN" ? "CLOSED" : "OPEN"; this.state.doorLocked = false; }
  /** 마피아가 닫힌 셔터를 잠가 시민을 고립시킨다. */
  lockDoor(team: RoleTeam, position: Vector3Data): void { this.require(team === "MAFIA" && near(position, SECURITY_SHUTTER_POSITION) && this.state.doorState === "CLOSED", "셔터 잠금 조건을 만족하지 않습니다."); this.state.doorState = "LOCKED"; this.state.doorLocked = true; }
  /** 마피아가 원격으로 통신을 끊어 CCTV와 회의 채팅을 제한한다. */
  sabotageCommunications(playerId: string, team: RoleTeam, now: number): void { this.require(team === "MAFIA" && this.state.communicationsOnline && this.state.criticalSabotageEndsAt === undefined && this.ready(playerId, now), "통신 장애 조건을 만족하지 않습니다."); this.state.communicationsOnline = false; this.state.cctvOnline = false; this.cctvOperators.clear(); }
  /** 시민이 통신실 장치 가까이에서 통신을 복구한다. */
  repairCommunications(team: RoleTeam, position: Vector3Data): void { this.require(team === "SURVIVOR" && !this.state.communicationsOnline && near(position, COMMUNICATIONS_CONSOLE_POSITION), "통신 복구 조건을 만족하지 않습니다."); this.state.communicationsOnline = true; this.state.cctvOnline = this.state.generatorOnline; }
  /** 시민이 전력이 정상인 관제실 조작대에서 CCTV 관제를 시작한다. */
  startCctv(playerId: string, team: RoleTeam, position: Vector3Data): void { this.require(team === "SURVIVOR" && this.state.cctvOnline && near(position, CCTV_CONSOLE_POSITION), "CCTV 관제 조건을 만족하지 않습니다."); this.cctvOperators.add(playerId); }
  /** 참가자가 CCTV 관제를 닫아 다시 이동할 수 있게 한다. */
  stopCctv(playerId: string): void { this.cctvOperators.delete(playerId); }
  /** 지정 참가자가 서버에서 승인된 CCTV 관제 중인지 반환한다. */
  isCctvOperating(playerId: string): boolean { return this.cctvOperators.has(playerId); }
  /** 시민의 회로 연결 퍼즐 정답과 제어반 거리를 검증해 공통 임무를 누적한다.
   * @returns 이번 퍼즐로 공통 임무가 완료됐는지 여부
   */
  completeCircuitTask(playerId: string, team: RoleTeam, position: Vector3Data, puzzle: string[]): boolean {
    this.require(team === "SURVIVOR" && near(position, CIRCUIT_PANEL_POSITION) && !this.completedCircuitPlayers.has(playerId) && puzzle.length === CIRCUIT_ORDER.length && puzzle.every((color, index) => color === CIRCUIT_ORDER[index]), "회로 연결 조건을 만족하지 않습니다.");
    this.completedCircuitPlayers.add(playerId);
    this.state.taskProgress = Math.min(100, this.state.taskProgress + 25);
    return this.state.taskProgress >= 100;
  }
  /** 시민의 보안 카드 방향 패턴과 단말 거리를 검증해 공통 임무를 누적한다. */
  completeSecurityCardTask(playerId: string, team: RoleTeam, position: Vector3Data, pattern: string[]): boolean {
    this.require(team === "SURVIVOR" && near(position, SECURITY_CARD_POSITION) && !this.securityCardCompletedPlayers.has(playerId) && pattern.length === SECURITY_CARD_PATTERN.length && pattern.every((direction, index) => direction === SECURITY_CARD_PATTERN[index]), "보안 카드 인증 조건을 만족하지 않습니다.");
    this.securityCardCompletedPlayers.add(playerId);
    this.state.taskProgress = Math.min(100, this.state.taskProgress + 25);
    return this.state.taskProgress >= 100;
  }
  /** 시민이 자료 묶음을 오름차순으로 정렬했는지 서버에서 검증한다. */
  completeDataSortTask(playerId: string, team: RoleTeam, position: Vector3Data, order: string[]): boolean {
    this.require(team === "SURVIVOR" && near(position, DATA_SORTER_POSITION) && !this.dataSortCompletedPlayers.has(playerId) && order.length === DATA_SORT_ORDER.length && order.every((value, index) => value === DATA_SORT_ORDER[index]), "자료 정렬 조건을 만족하지 않습니다.");
    this.dataSortCompletedPlayers.add(playerId);
    this.state.taskProgress = Math.min(100, this.state.taskProgress + 25);
    return this.state.taskProgress >= 100;
  }
  /** 시민이 냉각수 세 계통을 목표 비율로 맞췄는지 서버에서 검증한다. */
  completeCoolantTask(playerId: string, team: RoleTeam, position: Vector3Data, ratios: string[]): boolean {
    this.require(team === "SURVIVOR" && near(position, COOLANT_MIXER_POSITION) && !this.coolantCompletedPlayers.has(playerId) && ratios.length === COOLANT_TARGET.length && ratios.every((value, index) => value === COOLANT_TARGET[index]), "냉각수 배합 조건을 만족하지 않습니다.");
    this.coolantCompletedPlayers.add(playerId);
    this.state.taskProgress = Math.min(100, this.state.taskProgress + 25);
    return this.state.taskProgress >= 100;
  }
  /** 시민이 동기화 단말 범위에서 협동 임무 참여를 시작한다. */
  startCooperativeTask(playerId: string, team: RoleTeam, position: Vector3Data, now: number): void {
    this.require(team === "SURVIVOR" && !this.state.blackout && this.state.criticalSabotageEndsAt === undefined && !this.state.cooperativeCompleted && near(position, COOPERATIVE_TASK_POSITION), "협동 임무 시작 조건을 만족하지 않습니다.");
    this.cooperativeParticipants.add(playerId);
    if (this.cooperativeParticipants.size >= 2 && this.cooperativeActiveSince === undefined) this.cooperativeActiveSince = now;
  }
  /** 버튼을 놓은 시민을 협동 임무 참여자에서 제거하고 인원이 부족하면 연속 진행을 취소한다. */
  cancelCooperativeTask(playerId: string): void {
    this.cooperativeParticipants.delete(playerId);
    if (this.cooperativeParticipants.size < 2) { this.cooperativeActiveSince = undefined; this.state.cooperativeProgress = 0; }
  }
  /** 서버가 현재 생존·접속·거리 조건을 다시 검사해 협동 임무를 진행한다.
   * @param eligiblePlayers 현재 역할·생존·접속 조건을 만족하는 시민 목록
   * @param now 현재 서버 시각
   * @returns 환경 변경 여부와 이번 호출의 임무 완료 여부
   */
  advanceCooperativeTask(eligiblePlayers: { id: string; position: Vector3Data }[], now: number): { changed: boolean; completed: boolean } {
    const beforeIds = [...this.cooperativeParticipants].join(",");
    const beforeProgress = this.state.cooperativeProgress;
    const eligible = new Set(eligiblePlayers.filter((player) => near(player.position, COOPERATIVE_TASK_POSITION)).map((player) => player.id));
    for (const playerId of this.cooperativeParticipants) if (!eligible.has(playerId)) this.cooperativeParticipants.delete(playerId);
    if (this.state.blackout || this.state.criticalSabotageEndsAt !== undefined || this.cooperativeParticipants.size < 2) { this.cooperativeActiveSince = undefined; this.state.cooperativeProgress = 0; }
    else {
      this.cooperativeActiveSince ??= now;
      this.state.cooperativeProgress = Math.min(1, (now - this.cooperativeActiveSince) / COOPERATIVE_TASK_DURATION_MS);
    }
    if (!this.state.cooperativeCompleted && this.state.cooperativeProgress >= 1) {
      this.state.cooperativeCompleted = true;
      this.state.taskProgress = Math.min(100, this.state.taskProgress + 25);
      this.cooperativeParticipants.clear();
      this.cooperativeActiveSince = undefined;
      this.state.cooperativeProgress = 1;
      return { changed: true, completed: true };
    }
    return { changed: beforeIds !== [...this.cooperativeParticipants].join(",") || beforeProgress !== this.state.cooperativeProgress, completed: false };
  }
  /** 시민이 서쪽 보급 상자에서 아직 완료하지 않은 운송 물품을 획득한다. */
  pickupCargo(playerId: string, team: RoleTeam, position: Vector3Data): void {
    this.require(team === "SURVIVOR" && near(position, CARGO_PICKUP_POSITION) && !this.cargoCarriers.has(playerId) && !this.cargoCompletedPlayers.has(playerId), "물품 획득 조건을 만족하지 않습니다.");
    this.cargoCarriers.add(playerId);
  }
  /** 시민이 획득한 물품을 동쪽 통신실 납품대까지 운송해 공동 임무를 진행한다.
   * @returns 이번 납품으로 공동 임무가 완료됐는지 여부
   */
  deliverCargo(playerId: string, team: RoleTeam, position: Vector3Data): boolean {
    this.require(team === "SURVIVOR" && near(position, CARGO_DELIVERY_POSITION) && this.cargoCarriers.has(playerId) && !this.cargoCompletedPlayers.has(playerId), "물품 납품 조건을 만족하지 않습니다.");
    this.cargoCarriers.delete(playerId);
    this.cargoCompletedPlayers.add(playerId);
    this.state.taskProgress = Math.min(100, this.state.taskProgress + 25);
    return this.state.taskProgress >= 100;
  }
  /** 사망·추방·연결 해제로 운송을 계속할 수 없는 참가자의 물품을 보급 상자로 되돌린다. @returns 변경 여부 */
  releaseInactiveCargo(activePlayerIds: Iterable<string>): boolean {
    const active = new Set(activePlayerIds);
    const before = this.cargoCarriers.size;
    for (const playerId of this.cargoCarriers) if (!active.has(playerId)) this.cargoCarriers.delete(playerId);
    return before !== this.cargoCarriers.size;
  }
  /** 시민이 바라보는 앞쪽에 한 판당 한 번만 바리케이드를 설치하고 경보를 울린다. */
  deployBarricade(playerId: string, team: RoleTeam, position: Vector3Data, rotation: number, now: number, canPlace: (position: Vector3Data) => boolean): void {
    const placement = { x: position.x - Math.sin(rotation) * 2, y: 0.8, z: position.z - Math.cos(rotation) * 2 };
    this.require(team === "SURVIVOR" && !this.barricadeUsers.has(playerId) && BARRICADE_USES_PER_SURVIVOR === 1 && canPlace(placement), "바리케이드 설치 조건을 만족하지 않습니다.");
    this.barricadeUsers.add(playerId);
    this.state.barricades.push({ id: `barricade-${playerId}`, ownerId: playerId, position: placement, expiresAt: now + BARRICADE_DURATION_MS });
    this.state.alarmActive = true;
  }
  /** 마피아가 가까운 활성 바리케이드를 해체해 우회 경로를 만든다. */
  dismantleNearestBarricade(team: RoleTeam, position: Vector3Data): void {
    const barricade = this.state.barricades.find((item) => near(position, item.position));
    this.require(team === "MAFIA" && barricade !== undefined, "바리케이드 해체 조건을 만족하지 않습니다.");
    this.state.barricades = this.state.barricades.filter((item) => item.id !== barricade.id);
    this.state.alarmActive = this.state.barricades.length > 0;
  }
  /** 만료 시각을 지난 바리케이드를 자동 해제한다. @returns 환경 상태 변경 여부 */
  advance(now: number): boolean {
    const active = this.state.barricades.filter((barricade) => barricade.expiresAt > now);
    if (active.length === this.state.barricades.length) return false;
    this.state.barricades = active;
    this.state.alarmActive = active.length > 0;
    return true;
  }
  private ready(id: string, now: number): boolean { const last = this.cooldowns.get(id) ?? -Infinity; if (now - last < 1000) return false; this.cooldowns.set(id, now); return true; }
  /** 정전 등으로 협동 임무 참여자와 연속 진행 시간을 모두 비운다. */
  private clearCooperativeTask(): void { this.cooperativeParticipants.clear(); this.cooperativeActiveSince = undefined; this.state.cooperativeProgress = 0; }
  private require(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
}
/** 두 위치가 상호작용 거리 안인지 확인한다. */
function near(left: Vector3Data, right: Vector3Data): boolean { return Math.hypot(left.x - right.x, left.z - right.z) <= INTERACTION_RANGE; }
