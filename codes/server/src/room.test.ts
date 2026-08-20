import { describe, expect, it, vi } from "vitest";
import { EnvironmentSystem } from "./environment.js";
import { GameRoom, MAX_PLAYERS, RoomError } from "./room.js";

/** 두 참가자가 처치 거리 안에 설 때까지 서버 권한 이동을 반복한다. */
function moveNear(room: GameRoom, moverId: string, targetId: string): void {
  for (let index = 1; index <= 100; index += 1) {
    const players = room.snapshot().players;
    const mover = players.find((player) => player.id === moverId)!;
    const target = players.find((player) => player.id === targetId)!;
    if (Math.hypot(mover.position.x - target.position.x, mover.position.z - target.position.z) < 1.5) return;
    room.move(moverId, { x: Math.sign(target.position.x - mover.position.x), z: Math.sign(target.position.z - mover.position.z) }, 0, true, index * 100, index);
  }
  throw new Error("참가자를 처치 거리 안으로 이동시키지 못했습니다.");
}

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
    const initialX = room.snapshot().players.find((player) => player.id === "host")!.position.x;
    room.move("host", { x: 100, z: 0 }, 0, false, 10_000);
    expect(room.snapshot().players.find((player) => player.id === "host")!.position.x).toBeCloseTo(initialX + 0.32);
  });

  it("원격 화면이 같은 방향을 그리도록 회전값을 표준 yaw 범위로 전파한다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    room.join("other", "상대", undefined, 0);
    room.setReady("host", true);
    room.setReady("other", true);
    room.setMafiaCount("host", 1);
    room.startGame("host", 0);
    room.move("host", { x: 0, z: 0 }, Math.PI * 2, false, 100, 1);
    expect(room.snapshot().players.find((player) => player.id === "host")!.rotation).toBeCloseTo(0);
  });

  it("게임 시작 때 참가자마다 서로 다른 무작위 스폰 위치를 배정한다", () => {
    const room = new GameRoom("test");
    for (let index = 0; index < 5; index += 1) { room.join(`p${index}`, `참가자 ${index}`, undefined, 0); room.setReady(`p${index}`, true); }
    room.setMafiaCount("p0", 1);
    room.startGame("p0", 0);
    const positions = room.snapshot().players.map((player) => `${player.position.x},${player.position.z}`);
    expect(new Set(positions).size).toBe(5);
    expect(room.snapshot().players.every((player) => player.position.y === 1.4)).toBe(true);
  });

  it("서버는 확장 맵 바깥 경계 벽을 통과하는 이동을 막는다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    room.join("other", "상대", undefined, 0);
    room.setReady("host", true);
    room.setReady("other", true);
    room.setMafiaCount("host", 1);
    room.startGame("host");
    for (let now = 100; now <= 50_000; now += 100) room.move("host", { x: 0, z: 1 }, 0, false, now);
    expect(room.snapshot().players.find((player) => player.id === "host")!.position.z).toBeLessThan(69.4);
  });

  it("유효하지 않은 이동 값은 위치에 반영하지 않는다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    room.join("other", "상대", undefined, 0);
    room.setReady("host", true);
    room.setReady("other", true);
    room.setMafiaCount("host", 1);
    room.startGame("host");
    const initialX = room.snapshot().players.find((player) => player.id === "host")!.position.x;
    expect(() => room.move("host", { x: Number.NaN, z: 0 }, 0, false, 100)).toThrow("올바르지");
    expect(room.snapshot().players.find((player) => player.id === "host")!.position.x).toBe(initialX);
  });

  it("마피아는 같은 마피아를 처치할 수 없다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    room.join("mafia", "동료", undefined, 0);
    room.join("survivor", "시민", undefined, 0);
    room.setReady("host", true);
    room.setReady("mafia", true);
    room.setReady("survivor", true);
    room.setMafiaCount("host", 2);
    room.startGame("host");
    expect(() => room.kill("host", "mafia", 0)).toThrow("처치 조건");
  });

  it("마피아는 시작 후 20초와 처치 후 25초를 기다려야 한다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    room.join("survivor", "시민", undefined, 0);
    room.setReady("host", true);
    room.setReady("survivor", true);
    room.setMafiaCount("host", 1);
    // 이 검증은 이동 경로가 아닌 처치 대기시간이 대상이므로, 인접 스폰으로 고정한다.
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    room.startGame("host", 0);
    random.mockRestore();
    expect(room.killCooldownRemainingMs("host", 0)).toBe(20_000);
    moveNear(room, "host", "survivor");
    expect(() => room.kill("host", "survivor", 19_999)).toThrow("재사용");
    room.kill("host", "survivor", 20_000);
    expect(room.killCooldownRemainingMs("host", 20_000)).toBe(25_000);
  });

  it("정전 중에도 처치한 시체를 마피아가 신고할 수 있다", () => {
    const room = new GameRoom("test");
    for (const id of ["host", "survivor-a", "survivor-b", "survivor-c"]) { room.join(id, id, undefined, 0); room.setReady(id, true); }
    room.setMafiaCount("host", 1);
    room.startGame("host", 0);
    room.teleport("host", { x: 0, y: 1.4, z: 0 });
    room.teleport("survivor-a", { x: 1, y: 1.4, z: 0 });
    const environment = new EnvironmentSystem();
    environment.sabotage("host", "MAFIA", "generator-a", 1_000);
    room.kill("host", "survivor-a", 20_000);
    const bodyId = room.snapshot().players.find((player) => player.id === "survivor-a")?.bodyId;
    expect(bodyId).toBeDefined();
    room.report("host", bodyId!);
    expect(room.snapshot().meeting).toMatchObject({ reporterId: "host", bodyId });
  });

  it("유예 시간 안에는 재접속 상태를 복구한다", () => {
    const room = new GameRoom("test");
    const joined = room.join("before", "기존", undefined, 0);
    room.disconnect("before", 100);
    room.join("after", "복귀", joined.resumeToken, 10_000);
    expect(room.snapshot().players).toHaveLength(1);
    expect(room.snapshot().players[0].displayName).toBe("복귀");
  });

  it("방장이 연결을 끊어도 방을 유지하고 다음 참가자에게 방장을 넘긴다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    room.join("other", "상대", undefined, 0);
    room.disconnect("host", 100);
    expect(room.snapshot()).toMatchObject({ hostId: "other", players: [{ id: "host", connected: false }, { id: "other", connected: true }] });
  });
});
