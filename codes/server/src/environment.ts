import { GENERATOR_POSITIONS, REPAIR_HOLD_DURATION_MS, VENT_ENTRANCE_POSITION, VENT_EXIT_POSITION, type EnvironmentState, type GeneratorId, type RoleTeam, type Vector3Data } from "@mafia/shared";
const INITIAL_STATE: EnvironmentState = { blackout: false, generatorOnline: true, generators: { "generator-a": true, "generator-b": true }, cctvOnline: true, doorLocked: false, taskProgress: 0 };

/** 환경 장치의 거리, 역할, 쿨타임을 서버에서 검증한다. */
export class EnvironmentSystem {
  private state: EnvironmentState = { ...INITIAL_STATE, generators: { ...INITIAL_STATE.generators } };
  private readonly cooldowns = new Map<string, number>();
  private readonly repairStarts = new Map<string, number>();

  /** 현재 환경 상태의 복사본을 반환한다. */
  snapshot(): EnvironmentState { return { ...this.state, generators: { ...this.state.generators } }; }
  /** 새 게임 시작 전에 모든 장치를 정상 상태로 되돌린다. */
  reset(): void { this.state = { ...INITIAL_STATE, generators: { ...INITIAL_STATE.generators } }; this.cooldowns.clear(); this.repairStarts.clear(); }
  /** 마피아만 원격으로 지정한 발전기를 고장 내 정전을 시작할 수 있다. */
  sabotage(playerId: string, team: RoleTeam, generatorId: GeneratorId, now: number): void { this.require(team === "MAFIA" && !this.state.blackout && this.state.generators[generatorId] && this.ready(playerId, now), "정전 조건을 만족하지 않습니다."); this.state.blackout = true; this.state.generatorOnline = false; this.state.generators[generatorId] = false; this.state.cctvOnline = false; }
  /** 시민이 발전기 근처에서 복구 버튼 유지를 시작한다. */
  startRepair(playerId: string, team: RoleTeam, generatorId: GeneratorId, position: Vector3Data, now: number): void { this.require(team === "SURVIVOR" && this.state.blackout && !this.state.generators[generatorId] && near(position, GENERATOR_POSITIONS[generatorId]), "복구 시작 조건을 만족하지 않습니다."); this.repairStarts.set(playerId, now); }
  /** 시민이 3초간 복구 버튼을 유지했는지 확인하고 정전을 해제한다. */
  completeRepair(playerId: string, team: RoleTeam, generatorId: GeneratorId, position: Vector3Data, now: number): void { const startedAt = this.repairStarts.get(playerId); this.require(team === "SURVIVOR" && this.state.blackout && !this.state.generators[generatorId] && startedAt !== undefined && now - startedAt >= REPAIR_HOLD_DURATION_MS && near(position, GENERATOR_POSITIONS[generatorId]), "복구 조건을 만족하지 않습니다."); this.repairStarts.delete(playerId); this.state.generators[generatorId] = true; this.state.blackout = false; this.state.generatorOnline = true; this.state.cctvOnline = true; }
  /** 버튼을 놓거나 취소한 시민의 복구 진행 상태를 제거한다. */
  cancelRepair(playerId: string): void { this.repairStarts.delete(playerId); }
  /** 마피아 전용 환풍구 이동 권한을 검증한다. */
  useVent(team: RoleTeam, position: Vector3Data): Vector3Data { this.require(team === "MAFIA" && near(position, VENT_ENTRANCE_POSITION), "환풍구 권한 또는 거리가 올바르지 않습니다."); return { ...VENT_EXIT_POSITION }; }
  /** 공동 임무 진행도를 서버에서 누적한다. */
  completeTask(team: RoleTeam, position: Vector3Data): void { this.require(team === "SURVIVOR" && near(position, GENERATOR_POSITIONS["generator-a"]), "임무 조건을 만족하지 않습니다."); this.state.taskProgress = Math.min(100, this.state.taskProgress + 25); }
  private ready(id: string, now: number): boolean { const last = this.cooldowns.get(id) ?? -Infinity; if (now - last < 1000) return false; this.cooldowns.set(id, now); return true; }
  private require(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
}
/** 두 위치가 상호작용 거리 안인지 확인한다. */
function near(left: Vector3Data, right: Vector3Data): boolean { return Math.hypot(left.x - right.x, left.z - right.z) <= 2; }
