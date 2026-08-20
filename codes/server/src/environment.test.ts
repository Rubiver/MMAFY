import { describe, expect, it } from "vitest";
import { EnvironmentSystem } from "./environment.js";

const generator = { x: -12, y: 1.4, z: -8 };

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
    environment.completeTask("SURVIVOR", generator);
    environment.reset();
    expect(environment.snapshot()).toEqual({ blackout: false, generatorOnline: true, generators: { "generator-a": true, "generator-b": true }, cctvOnline: true, doorLocked: false, taskProgress: 0 });
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
});
