import { describe, expect, it } from "vitest";
import { movementSpeed, movementVector } from "./movement";

describe("이동 계산", () => {
  it("대각선 이동 속도를 정규화한다", () => {
    const vector = movementVector({ forward: true, backward: false, left: false, right: true, run: false });
    expect(Math.hypot(vector.x, vector.z)).toBeCloseTo(1);
  });

  it("달리기 속도가 걷기 속도보다 빠르다", () => {
    expect(movementSpeed(true)).toBeGreaterThan(movementSpeed(false));
  });
});
