import { describe, expect, it } from "vitest";
import { CARGO_DELIVERY_POSITION, CARGO_PICKUP_POSITION, CCTV_CONSOLE_POSITION, CIRCUIT_PANEL_POSITION, COOPERATIVE_TASK_POSITION, GENERATOR_POSITIONS, SECURITY_CARD_POSITION, SECURITY_SHUTTER_POSITION, VENT_ENTRANCE_POSITION, VENT_EXIT_POSITION } from "@mafia/shared";
import { EnvironmentSystem } from "./environment.js";

const generator = { ...GENERATOR_POSITIONS["generator-a"], y: 1.4 };

describe("EnvironmentSystem", () => {
  it("마피아가 발전기 근처에서 정전을 시작하면 전력과 CCTV를 끈다", () => {
    const environment = new EnvironmentSystem();
    environment.sabotage("mafia", "MAFIA", "generator-a", 1_000);
    expect(environment.snapshot()).toMatchObject({ blackout: true, generatorOnline: false, generators: { "generator-a": false, "generator-b": true }, cctvOnline: false });
  });

  it("시민이 발전기 근처에서 복구하면 정전이 끝난다", () => {
    const environment = new EnvironmentSystem();
    environment.sabotage("mafia", "MAFIA", "generator-a", 1_000);
    environment.startRepair("survivor", "SURVIVOR", "generator-a", generator, 2_000);
    environment.completeRepair("survivor", "SURVIVOR", "generator-a", generator, 5_000);
    expect(environment.snapshot()).toMatchObject({ blackout: false, generatorOnline: true, cctvOnline: true });
  });

  it("새 게임을 위해 초기화하면 정전과 임무 진행도를 지운다", () => {
    const environment = new EnvironmentSystem();
    environment.sabotage("mafia", "MAFIA", "generator-b", 1_000);
    environment.completeCircuitTask("survivor", "SURVIVOR", CIRCUIT_PANEL_POSITION, ["AMBER", "CYAN", "VIOLET"]);
    environment.reset();
    expect(environment.snapshot()).toEqual({ blackout: false, generatorOnline: true, generators: { "generator-a": true, "generator-b": true }, cctvOnline: true, communicationsOnline: true, doorLocked: false, doorState: "OPEN", taskProgress: 0, alarmActive: false, barricades: [], cargoCarrierIds: [], cargoCompletedIds: [], securityCardCompletedIds: [], cooperativeParticipantIds: [], cooperativeProgress: 0, cooperativeCompleted: false });
  });

  it("3초보다 일찍 복구 완료를 요청하면 정전이 유지된다", () => {
    const environment = new EnvironmentSystem();
    environment.sabotage("mafia", "MAFIA", "generator-a", 1_000);
    environment.startRepair("survivor", "SURVIVOR", "generator-a", generator, 2_000);
    expect(() => environment.completeRepair("survivor", "SURVIVOR", "generator-a", generator, 4_999)).toThrow("복구 조건");
    expect(environment.snapshot().blackout).toBe(true);
  });

  it("발전기 B를 고장 낸 경우 발전기 A에서는 복구를 시작할 수 없다", () => {
    const environment = new EnvironmentSystem();
    environment.sabotage("mafia", "MAFIA", "generator-b", 1_000);
    expect(() => environment.startRepair("survivor", "SURVIVOR", "generator-a", generator, 2_000)).toThrow("복구 시작");
  });

  it("마피아는 양쪽 환풍구에서 반대편 출구로 이동할 수 있다", () => {
    const environment = new EnvironmentSystem();
    expect(environment.useVent("MAFIA", VENT_ENTRANCE_POSITION)).toEqual(VENT_EXIT_POSITION);
    expect(environment.useVent("MAFIA", VENT_EXIT_POSITION)).toEqual({ ...VENT_ENTRANCE_POSITION, y: VENT_EXIT_POSITION.y });
    expect(() => environment.useVent("SURVIVOR", VENT_ENTRANCE_POSITION)).toThrow("환풍구");
  });

  it("시민만 제어반에서 올바른 회로 순서를 한 번 완료할 수 있다", () => {
    const environment = new EnvironmentSystem();
    expect(() => environment.completeCircuitTask("survivor", "SURVIVOR", CIRCUIT_PANEL_POSITION, ["CYAN", "AMBER", "VIOLET"])).toThrow("회로 연결");
    expect(environment.completeCircuitTask("survivor", "SURVIVOR", CIRCUIT_PANEL_POSITION, ["AMBER", "CYAN", "VIOLET"])).toBe(false);
    expect(environment.snapshot().taskProgress).toBe(25);
    expect(() => environment.completeCircuitTask("survivor", "SURVIVOR", CIRCUIT_PANEL_POSITION, ["AMBER", "CYAN", "VIOLET"])).toThrow("회로 연결");
  });

  it("시민만 단말 가까이에서 올바른 보안 카드 패턴을 한 번 인증할 수 있다", () => {
    const environment = new EnvironmentSystem();
    expect(() => environment.completeSecurityCardTask("survivor", "SURVIVOR", SECURITY_CARD_POSITION, ["LEFT", "RIGHT", "UP", "DOWN"])).toThrow("보안 카드 인증");
    expect(() => environment.completeSecurityCardTask("mafia", "MAFIA", SECURITY_CARD_POSITION, ["LEFT", "UP", "RIGHT", "DOWN"])).toThrow("보안 카드 인증");
    expect(environment.completeSecurityCardTask("survivor", "SURVIVOR", SECURITY_CARD_POSITION, ["LEFT", "UP", "RIGHT", "DOWN"])).toBe(false);
    expect(environment.snapshot()).toMatchObject({ taskProgress: 25, securityCardCompletedIds: ["survivor"] });
    expect(() => environment.completeSecurityCardTask("survivor", "SURVIVOR", SECURITY_CARD_POSITION, ["LEFT", "UP", "RIGHT", "DOWN"])).toThrow("보안 카드 인증");
  });

  it("두 시민이 동기화 단말에서 5초간 함께 유지해야 협동 임무를 완료한다", () => {
    const environment = new EnvironmentSystem();
    const players = [{ id: "survivor-a", position: COOPERATIVE_TASK_POSITION }, { id: "survivor-b", position: COOPERATIVE_TASK_POSITION }];
    environment.startCooperativeTask("survivor-a", "SURVIVOR", COOPERATIVE_TASK_POSITION, 1_000);
    expect(environment.advanceCooperativeTask(players, 6_000)).toMatchObject({ completed: false });
    expect(environment.snapshot()).toMatchObject({ cooperativeParticipantIds: ["survivor-a"], cooperativeProgress: 0, taskProgress: 0 });
    environment.startCooperativeTask("survivor-b", "SURVIVOR", COOPERATIVE_TASK_POSITION, 6_000);
    expect(environment.advanceCooperativeTask(players, 10_999)).toMatchObject({ completed: false });
    expect(environment.snapshot().cooperativeProgress).toBeCloseTo(0.9998);
    expect(environment.advanceCooperativeTask(players, 11_000)).toEqual({ changed: true, completed: true });
    expect(environment.snapshot()).toMatchObject({ cooperativeParticipantIds: [], cooperativeProgress: 1, cooperativeCompleted: true, taskProgress: 25 });
  });

  it("협동 임무는 이탈·사망·정전 때 연속 진행을 취소한다", () => {
    const environment = new EnvironmentSystem();
    const both = [{ id: "survivor-a", position: COOPERATIVE_TASK_POSITION }, { id: "survivor-b", position: COOPERATIVE_TASK_POSITION }];
    environment.startCooperativeTask("survivor-a", "SURVIVOR", COOPERATIVE_TASK_POSITION, 1_000);
    environment.startCooperativeTask("survivor-b", "SURVIVOR", COOPERATIVE_TASK_POSITION, 1_000);
    environment.advanceCooperativeTask(both, 3_000);
    environment.advanceCooperativeTask([both[0]], 3_001);
    expect(environment.snapshot()).toMatchObject({ cooperativeParticipantIds: ["survivor-a"], cooperativeProgress: 0 });
    environment.startCooperativeTask("survivor-b", "SURVIVOR", COOPERATIVE_TASK_POSITION, 4_000);
    environment.sabotage("mafia", "MAFIA", "generator-a", 4_001);
    expect(environment.snapshot()).toMatchObject({ blackout: true, cooperativeParticipantIds: [], cooperativeProgress: 0, cooperativeCompleted: false });
    expect(() => environment.startCooperativeTask("survivor-a", "SURVIVOR", COOPERATIVE_TASK_POSITION, 5_000)).toThrow("협동 임무 시작");
  });

  it("시민은 셔터를 개폐하고 마피아는 닫힌 셔터를 잠근다", () => {
    const environment = new EnvironmentSystem();
    environment.toggleDoor("SURVIVOR", SECURITY_SHUTTER_POSITION);
    environment.lockDoor("MAFIA", SECURITY_SHUTTER_POSITION);
    expect(environment.snapshot()).toMatchObject({ doorState: "LOCKED", doorLocked: true });
    expect(() => environment.toggleDoor("SURVIVOR", SECURITY_SHUTTER_POSITION)).toThrow("셔터");
  });

  it("마피아 통신 장애는 CCTV를 끄고 시민 통신실 복구로 해제된다", () => {
    const environment = new EnvironmentSystem();
    environment.sabotageCommunications("mafia", "MAFIA", 1_000);
    expect(environment.snapshot()).toMatchObject({ communicationsOnline: false, cctvOnline: false });
    expect(() => environment.repairCommunications("MAFIA", { x: 58, y: 0, z: 42 })).toThrow("통신 복구");
    environment.repairCommunications("SURVIVOR", { x: 58, y: 0, z: 42 });
    expect(environment.snapshot()).toMatchObject({ communicationsOnline: true, cctvOnline: true });
  });

  it("시민만 관제실에서 CCTV를 열 수 있고 정전은 관제를 종료한다", () => {
    const environment = new EnvironmentSystem();
    environment.startCctv("survivor", "SURVIVOR", CCTV_CONSOLE_POSITION);
    expect(environment.isCctvOperating("survivor")).toBe(true);
    expect(() => environment.startCctv("mafia", "MAFIA", CCTV_CONSOLE_POSITION)).toThrow("CCTV 관제");
    environment.sabotage("mafia", "MAFIA", "generator-a", 1_000);
    expect(environment.isCctvOperating("survivor")).toBe(false);
    expect(() => environment.startCctv("survivor", "SURVIVOR", CCTV_CONSOLE_POSITION)).toThrow("CCTV 관제");
  });

  it("시민은 한 판에 한 번만 30초 경보 바리케이드를 설치할 수 있다", () => {
    const environment = new EnvironmentSystem();
    const position = { x: 20, y: 1.4, z: 20 };
    environment.deployBarricade("survivor", "SURVIVOR", position, 0, 1_000, () => true);
    expect(environment.snapshot()).toMatchObject({ alarmActive: true, barricades: [{ ownerId: "survivor", position: { x: 20, y: 0.8, z: 18 }, expiresAt: 31_000 }] });
    expect(() => environment.deployBarricade("survivor", "SURVIVOR", position, 0, 2_000, () => true)).toThrow("바리케이드 설치");
    expect(environment.advance(30_999)).toBe(false);
    expect(environment.advance(31_000)).toBe(true);
    expect(environment.snapshot()).toMatchObject({ alarmActive: false, barricades: [] });
  });

  it("마피아만 가까운 경보 바리케이드를 해체할 수 있다", () => {
    const environment = new EnvironmentSystem();
    environment.deployBarricade("survivor", "SURVIVOR", { x: 20, y: 1.4, z: 20 }, 0, 1_000, () => true);
    expect(() => environment.dismantleNearestBarricade("SURVIVOR", { x: 20, y: 1.4, z: 18.3 })).toThrow("바리케이드 해체");
    environment.dismantleNearestBarricade("MAFIA", { x: 20, y: 1.4, z: 18.3 });
    expect(environment.snapshot()).toMatchObject({ alarmActive: false, barricades: [] });
  });

  it("시민은 보급 상자 획득 뒤 통신실 납품 순서로 한 번만 공통 임무를 진행한다", () => {
    const environment = new EnvironmentSystem();
    expect(() => environment.deliverCargo("survivor", "SURVIVOR", CARGO_DELIVERY_POSITION)).toThrow("물품 납품");
    expect(() => environment.pickupCargo("mafia", "MAFIA", CARGO_PICKUP_POSITION)).toThrow("물품 획득");
    environment.pickupCargo("survivor", "SURVIVOR", CARGO_PICKUP_POSITION);
    expect(environment.snapshot()).toMatchObject({ cargoCarrierIds: ["survivor"], taskProgress: 0 });
    expect(environment.deliverCargo("survivor", "SURVIVOR", CARGO_DELIVERY_POSITION)).toBe(false);
    expect(environment.snapshot()).toMatchObject({ cargoCarrierIds: [], cargoCompletedIds: ["survivor"], taskProgress: 25 });
    expect(() => environment.pickupCargo("survivor", "SURVIVOR", CARGO_PICKUP_POSITION)).toThrow("물품 획득");
  });

  it("사망하거나 연결이 끊긴 운송자의 물품은 서버가 보급 상자로 되돌린다", () => {
    const environment = new EnvironmentSystem();
    environment.pickupCargo("survivor", "SURVIVOR", CARGO_PICKUP_POSITION);
    expect(environment.releaseInactiveCargo([])).toBe(true);
    expect(environment.snapshot().cargoCarrierIds).toEqual([]);
    environment.pickupCargo("survivor", "SURVIVOR", CARGO_PICKUP_POSITION);
    expect(environment.releaseInactiveCargo(["survivor"])).toBe(false);
  });
});
