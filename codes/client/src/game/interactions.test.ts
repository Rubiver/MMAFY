import { describe, expect, it } from "vitest";
import { findCrosshairInteractable, findCrosshairKillTarget, findNearbyInteractable, findPrimaryAction } from "./interactions";
import { resolveLocalMovement } from "./localMovement";

describe("상호작용 거리", () => {
  const device = { id: "g", name: "발전기", type: "GENERATOR" as const, position: { x: 2, y: 0, z: 0 }, interactionRange: 2.4, currentState: "READY" as const };

  it("범위 안 장치를 찾는다", () => {
    expect(findNearbyInteractable({ x: 0, y: 0, z: 0 }, [device])).toBe(device);
  });

  it("기본 행동은 신고를 우선하고, 조준 대상이 없으면 가까운 시민을 처치 대상으로 쓴다", () => {
    expect(findPrimaryAction("body-1", "MAFIA", "survivor-1", ["survivor-1"])).toEqual({ type: "REPORT", bodyId: "body-1" });
    expect(findPrimaryAction(undefined, "MAFIA", undefined, ["survivor-1"])).toEqual({ type: "KILL", targetId: "survivor-1" });
  });

  it("범위 밖 장치를 제외한다", () => {
    expect(findNearbyInteractable({ x: -1, y: 0, z: 0 }, [device])).toBeUndefined();
  });

  it("크로스헤어가 향하는 범위 안 장치만 찾는다", () => {
    expect(findCrosshairInteractable({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, [device])).toBe(device);
    expect(findCrosshairInteractable({ x: 0, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, [device])).toBeUndefined();
  });

  it("가까운 시민을 메시 교차와 무관하게 크로스헤어 방향으로 찾는다", () => {
    const players = [
      { id: "mafia", displayName: "마피아", position: { x: 0, y: 1.4, z: 0 }, rotation: 0, ready: true, connected: true, lifeState: "ALIVE" as const },
      { id: "citizen", displayName: "시민", position: { x: 1.8, y: 1.4, z: 0.2 }, rotation: 0, ready: true, connected: true, lifeState: "ALIVE" as const },
      { id: "behind", displayName: "뒤", position: { x: -1, y: 1.4, z: 0 }, rotation: 0, ready: true, connected: true, lifeState: "ALIVE" as const },
    ];
    expect(findCrosshairKillTarget({ x: 0, y: 1.4, z: 0 }, { x: 1, y: 0, z: 0 }, players, ["mafia"])?.id).toBe("citizen");
  });

  it("서버가 공유한 바리케이드는 클라이언트 예측 이동도 막는다", () => {
    const position = { x: 0, y: 1.4, z: 0 };
    const barricades = [{ id: "barricade-survivor", ownerId: "survivor", position: { x: 1.6, y: 0.8, z: 0 }, expiresAt: 30_000 }];
    expect(resolveLocalMovement(position, { x: 1, z: 0 }, false, barricades).x).toBeLessThan(1);
  });
});
