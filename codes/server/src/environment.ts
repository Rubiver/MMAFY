import type { EnvironmentState, RoleTeam, Vector3Data } from "@mafia/shared";

/** 환경 장치의 거리, 역할, 쿨타임을 서버에서 검증한다. */
export class EnvironmentSystem {
  private state: EnvironmentState = { blackout: false, generatorOnline: true, cctvOnline: true, doorLocked: false, taskProgress: 0 };
  private readonly cooldowns = new Map<string, number>();

  /** 현재 환경 상태의 복사본을 반환한다. */
  snapshot(): EnvironmentState { return { ...this.state }; }
  /** 마피아만 정전을 시작할 수 있다. */
  sabotage(playerId: string, team: RoleTeam, position: Vector3Data, now: number): void { this.require(team === "MAFIA" && near(position, { x: -4, y: 0, z: -5 }) && this.ready(playerId, now), "정전 조건을 만족하지 않습니다."); this.state.blackout = true; this.state.generatorOnline = false; this.state.cctvOnline = false; }
  /** 생존자가 발전기를 복구해 정전을 끝낸다. */
  repair(playerId: string, team: RoleTeam, position: Vector3Data, now: number): void { this.require(team === "SURVIVOR" && near(position, { x: -4, y: 0, z: -5 }) && this.ready(playerId, now), "복구 조건을 만족하지 않습니다."); this.state.blackout = false; this.state.generatorOnline = true; this.state.cctvOnline = true; }
  /** 마피아 전용 환풍구 이동 권한을 검증한다. */
  useVent(team: RoleTeam, position: Vector3Data): Vector3Data { this.require(team === "MAFIA" && near(position, { x: 5, y: 0, z: -5 }), "환풍구 권한 또는 거리가 올바르지 않습니다."); return { x: -5, y: 1.4, z: -5 }; }
  /** 공동 임무 진행도를 서버에서 누적한다. */
  completeTask(team: RoleTeam, position: Vector3Data): void { this.require(team === "SURVIVOR" && near(position, { x: -4, y: 0, z: -5 }), "임무 조건을 만족하지 않습니다."); this.state.taskProgress = Math.min(100, this.state.taskProgress + 25); }
  private ready(id: string, now: number): boolean { const last = this.cooldowns.get(id) ?? -Infinity; if (now - last < 1000) return false; this.cooldowns.set(id, now); return true; }
  private require(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
}
/** 두 위치가 상호작용 거리 안인지 확인한다. */
function near(left: Vector3Data, right: Vector3Data): boolean { return Math.hypot(left.x - right.x, left.z - right.z) <= 2; }
