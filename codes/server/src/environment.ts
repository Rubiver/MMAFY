import { CCTV_CONSOLE_POSITION, CIRCUIT_PANEL_POSITION, GENERATOR_POSITIONS, REPAIR_HOLD_DURATION_MS, SECURITY_SHUTTER_POSITION, VENT_ENTRANCE_POSITION, VENT_EXIT_POSITION, type EnvironmentState, type GeneratorId, type RoleTeam, type Vector3Data } from "@mafia/shared";
const INITIAL_STATE: EnvironmentState = { blackout: false, generatorOnline: true, generators: { "generator-a": true, "generator-b": true }, cctvOnline: true, doorLocked: false, doorState: "OPEN", taskProgress: 0 };
const CIRCUIT_ORDER = ["AMBER", "CYAN", "VIOLET"] as const;

/** 환경 장치의 거리, 역할, 쿨타임을 서버에서 검증한다. */
export class EnvironmentSystem {
  private state: EnvironmentState = { ...INITIAL_STATE, generators: { ...INITIAL_STATE.generators } };
  private readonly cooldowns = new Map<string, number>();
  private readonly repairStarts = new Map<string, number>();
  private readonly completedCircuitPlayers = new Set<string>();
  private readonly cctvOperators = new Set<string>();

  /** 현재 환경 상태의 복사본을 반환한다. */
  snapshot(): EnvironmentState { return { ...this.state, generators: { ...this.state.generators } }; }
  /** 새 게임 시작 전에 모든 장치를 정상 상태로 되돌린다. */
  reset(): void { this.state = { ...INITIAL_STATE, generators: { ...INITIAL_STATE.generators } }; this.cooldowns.clear(); this.repairStarts.clear(); this.completedCircuitPlayers.clear(); this.cctvOperators.clear(); }
  /** 마피아만 원격으로 지정한 발전기를 고장 내 정전을 시작할 수 있다. */
  sabotage(playerId: string, team: RoleTeam, generatorId: GeneratorId, now: number): void { this.require(team === "MAFIA" && !this.state.blackout && this.state.generators[generatorId] && this.ready(playerId, now), "정전 조건을 만족하지 않습니다."); this.state.blackout = true; this.state.generatorOnline = false; this.state.generators[generatorId] = false; this.state.cctvOnline = false; this.cctvOperators.clear(); }
  /** 시민이 발전기 근처에서 복구 버튼 유지를 시작한다. */
  startRepair(playerId: string, team: RoleTeam, generatorId: GeneratorId, position: Vector3Data, now: number): void { this.require(team === "SURVIVOR" && this.state.blackout && !this.state.generators[generatorId] && near(position, GENERATOR_POSITIONS[generatorId]), "복구 시작 조건을 만족하지 않습니다."); this.repairStarts.set(playerId, now); }
  /** 시민이 3초간 복구 버튼을 유지했는지 확인하고 정전을 해제한다. */
  completeRepair(playerId: string, team: RoleTeam, generatorId: GeneratorId, position: Vector3Data, now: number): void { const startedAt = this.repairStarts.get(playerId); this.require(team === "SURVIVOR" && this.state.blackout && !this.state.generators[generatorId] && startedAt !== undefined && now - startedAt >= REPAIR_HOLD_DURATION_MS && near(position, GENERATOR_POSITIONS[generatorId]), "복구 조건을 만족하지 않습니다."); this.repairStarts.delete(playerId); this.state.generators[generatorId] = true; this.state.blackout = false; this.state.generatorOnline = true; this.state.cctvOnline = true; }
  /** 버튼을 놓거나 취소한 시민의 복구 진행 상태를 제거한다. */
  cancelRepair(playerId: string): void { this.repairStarts.delete(playerId); }
  /** 마피아 전용 환풍구 이동 권한을 검증한다. */
  useVent(team: RoleTeam, position: Vector3Data): Vector3Data { this.require(team === "MAFIA" && near(position, VENT_ENTRANCE_POSITION), "환풍구 권한 또는 거리가 올바르지 않습니다."); return { ...VENT_EXIT_POSITION }; }
  /** 시민이 셔터 가까이에서 열고 닫게 한다. */
  toggleDoor(team: RoleTeam, position: Vector3Data): void { this.require(team === "SURVIVOR" && near(position, SECURITY_SHUTTER_POSITION) && this.state.doorState !== "LOCKED", "셔터 개폐 조건을 만족하지 않습니다."); this.state.doorState = this.state.doorState === "OPEN" ? "CLOSED" : "OPEN"; this.state.doorLocked = false; }
  /** 마피아가 닫힌 셔터를 잠가 시민을 고립시킨다. */
  lockDoor(team: RoleTeam, position: Vector3Data): void { this.require(team === "MAFIA" && near(position, SECURITY_SHUTTER_POSITION) && this.state.doorState === "CLOSED", "셔터 잠금 조건을 만족하지 않습니다."); this.state.doorState = "LOCKED"; this.state.doorLocked = true; }
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
  private ready(id: string, now: number): boolean { const last = this.cooldowns.get(id) ?? -Infinity; if (now - last < 1000) return false; this.cooldowns.set(id, now); return true; }
  private require(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
}
/** 두 위치가 상호작용 거리 안인지 확인한다. */
function near(left: Vector3Data, right: Vector3Data): boolean { return Math.hypot(left.x - right.x, left.z - right.z) <= 2; }
