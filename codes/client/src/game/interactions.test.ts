import { describe, expect, it } from "vitest";
import { findNearbyInteractable } from "./interactions";

describe("상호작용 거리", () => {
  const device = { id: "g", name: "발전기", type: "GENERATOR" as const, position: { x: 2, y: 0, z: 0 }, interactionRange: 2.4, currentState: "READY" as const };

  it("범위 안 장치를 찾는다", () => {
    expect(findNearbyInteractable({ x: 0, y: 0, z: 0 }, [device])).toBe(device);
  });

  it("범위 밖 장치를 제외한다", () => {
    expect(findNearbyInteractable({ x: -1, y: 0, z: 0 }, [device])).toBeUndefined();
  });
});
