import { describe, expect, it } from "vitest";
import { GameRoom, MAX_PLAYERS, RoomError } from "./room.js";

describe("GameRoom", () => {
  it("최대 25명을 허용하고 초과 입장을 막는다", () => {
    const room = new GameRoom("test");
    for (let index = 0; index < MAX_PLAYERS; index += 1) room.join(`p${index}`, `참가자 ${index}`, undefined, 0);
    expect(() => room.join("extra", "초과", undefined, 0)).toThrowError(RoomError);
  });

  it("준비되지 않은 참가자가 있으면 시작을 막는다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    expect(() => room.startGame("host")).toThrow("준비");
  });

  it("서버는 이동 시간과 속도를 제한한다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    room.join("other", "상대", undefined, 0);
    room.setReady("host", true);
    room.setReady("other", true);
    room.setMafiaCount("host", 1);
    room.startGame("host");
    room.move("host", { x: 100, z: 0 }, 0, 10_000);
    expect(room.snapshot().players[0].position.x).toBeCloseTo(0.4);
  });

  it("유효하지 않은 이동 값은 위치에 반영하지 않는다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    room.join("other", "상대", undefined, 0);
    room.setReady("host", true);
    room.setReady("other", true);
    room.setMafiaCount("host", 1);
    room.startGame("host");
    expect(() => room.move("host", { x: Number.NaN, z: 0 }, 0, 100)).toThrow("올바르지");
    expect(room.snapshot().players[0].position.x).toBe(0);
  });

  it("유예 시간 안에는 재접속 상태를 복구한다", () => {
    const room = new GameRoom("test");
    const joined = room.join("before", "기존", undefined, 0);
    room.disconnect("before", 100);
    room.join("after", "복귀", joined.resumeToken, 10_000);
    expect(room.snapshot().players).toHaveLength(1);
    expect(room.snapshot().players[0].displayName).toBe("복귀");
  });
});
