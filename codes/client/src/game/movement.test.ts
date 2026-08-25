import { describe, expect, it } from "vitest";
import type { BarricadeState } from "@mafia/shared";
import { isWalkablePosition, resolveLocalMovement } from "./localMovement";
import { facingYaw, movementSpeed, movementVector } from "./movement";

describe("이동 계산", () => {
  it("대각선 이동 속도를 정규화한다", () => {
    const vector = movementVector({ forward: true, backward: false, left: false, right: true, run: false });
    expect(Math.hypot(vector.x, vector.z)).toBeCloseTo(1);
  });

  it("달리기 속도가 걷기 속도보다 빠르다", () => {
    expect(movementSpeed(true)).toBeGreaterThan(movementSpeed(false));
  });

  it("카메라 전방 벡터를 모델 앞면 기준 yaw로 변환한다", () => {
    expect(facingYaw({ x: 0, z: -1 })).toBeCloseTo(0);
    expect(facingYaw({ x: 1, z: 0 })).toBeCloseTo(-Math.PI / 2);
    // π와 -π는 같은 뒷방향이므로 표준 범위의 -π를 기대한다.
    expect(facingYaw({ x: 0, z: 1 })).toBeCloseTo(-Math.PI);
  });

  it("교량 갑판 밖의 강 충돌 구간을 통과하지 못한다", () => {
    const position = resolveLocalMovement({ x: -8.4, y: 1.4, z: -33 }, { x: 0.5, z: 0 });
    expect(position.x).toBeLessThanOrEqual(-8.35);
  });

  it("서버가 새 바리케이드를 전파했을 때 겹친 이전 좌표를 감지한다", () => {
    const barricades: BarricadeState[] = [{ id: "barricade", ownerId: "survivor", position: { x: 20, y: 0.8, z: 20 }, expiresAt: 30_000 }];
    expect(isWalkablePosition({ x: 21.3, y: 1.4, z: 21.3 }, false, barricades)).toBe(false);
  });
});
