import { describe, expect, it, vi } from "vitest";
import { EnvironmentSystem } from "./environment.js";
import { GameRoom, MAX_PLAYERS, RoomError } from "./room.js";
import { EMERGENCY_BELL_POSITION } from "@mafia/shared";

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

  it("바리케이드는 사각 충돌 범위의 모서리에 있는 참가자와도 겹쳐 설치할 수 없다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0); room.join("survivor", "시민", undefined, 0);
    room.setReady("host", true); room.setReady("survivor", true); room.setMafiaCount("host", 1); room.startGame("host", 0);
    room.teleport("host", { x: 21.3, y: 1.4, z: 21.3 });
    expect(room.canPlaceBarricade({ x: 20, y: 0.8, z: 20 }, [], "survivor")).toBe(false);
    room.teleport("host", { x: 22, y: 1.4, z: 22 });
    expect(room.canPlaceBarricade({ x: 20, y: 0.8, z: 20 }, [], "survivor")).toBe(true);
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
    room.report("host", bodyId!, 20_001);
    expect(room.snapshot().meeting).toMatchObject({ reporterId: "host", bodyId });
  });

  it("신고 회의가 끝난 뒤 살아 있는 마피아 수가 시민 수와 같으면 마피아가 승리한다", () => {
    const room = new GameRoom("test");
    room.join("host", "마피아", undefined, 0); room.join("survivor", "시민", undefined, 0);
    room.setReady("host", true); room.setReady("survivor", true); room.setMafiaCount("host", 1); room.startGame("host", 0);
    room.teleport("host", { x: 0, y: 1.4, z: 0 }); room.teleport("survivor", { x: 1, y: 1.4, z: 0 }); room.kill("host", "survivor", 20_000);
    const bodyId = room.snapshot().players.find((player) => player.id === "survivor")?.bodyId;
    room.report("host", bodyId!, 20_001); room.advance(110_001); room.advance(113_001);
    expect(room.snapshot()).toMatchObject({ gameState: "GAME_OVER", result: { winner: "MAFIA" } });
  });

  it("마피아가 마지막 시민을 처치해도 시체 신고 기회를 유지한다", () => {
    const room = new GameRoom("test");
    room.join("host", "마피아", undefined, 0);
    room.join("survivor", "시민", undefined, 0);
    room.setReady("host", true); room.setReady("survivor", true); room.setMafiaCount("host", 1);
    room.startGame("host", 0);
    room.teleport("host", { x: 0, y: 1.4, z: 0 }); room.teleport("survivor", { x: 1, y: 1.4, z: 0 });
    room.kill("host", "survivor", 20_000);
    const bodyId = room.snapshot().players.find((player) => player.id === "survivor")?.bodyId;
    expect(room.snapshot()).toMatchObject({ gameState: "PLAYING", players: expect.arrayContaining([expect.objectContaining({ id: "survivor", lifeState: "DEAD", bodyId: expect.any(String) })]) });
    room.report("host", bodyId!, 20_001);
    expect(room.snapshot().gameState).toBe("MEETING");
  });

  it("마지막 처치가 신고되지 않으면 10초 뒤 마피아 승리를 확정한다", () => {
    const room = new GameRoom("test");
    room.join("host", "마피아", undefined, 0); room.join("survivor", "시민", undefined, 0);
    room.setReady("host", true); room.setReady("survivor", true); room.setMafiaCount("host", 1); room.startGame("host", 0);
    room.teleport("host", { x: 0, y: 1.4, z: 0 }); room.teleport("survivor", { x: 1, y: 1.4, z: 0 }); room.kill("host", "survivor", 20_000);
    expect(room.advance(29_999)).toBe(false);
    expect(room.snapshot().gameState).toBe("PLAYING");
    expect(room.advance(30_000)).toBe(true);
    expect(room.snapshot()).toMatchObject({ gameState: "GAME_OVER", result: { winner: "MAFIA" } });
  });

  it("사망한 시민의 이동 요청은 서버가 무시한다", () => {
    const room = new GameRoom("test");
    room.join("host", "마피아", undefined, 0); room.join("survivor", "시민", undefined, 0);
    room.setReady("host", true); room.setReady("survivor", true); room.setMafiaCount("host", 1); room.startGame("host", 0);
    room.teleport("host", { x: 0, y: 1.4, z: 0 }); room.teleport("survivor", { x: 1, y: 1.4, z: 0 }); room.kill("host", "survivor", 20_000);
    const before = room.snapshot().players.find((player) => player.id === "survivor")!.position;
    expect(room.move("survivor", { x: 1, z: 0 }, 0, false, 20_100, 1)).toBeUndefined();
    expect(room.snapshot().players.find((player) => player.id === "survivor")!.position).toEqual(before);
  });

  it("관제 중인 시민의 서버 이동 요청은 무시한다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0); room.join("other", "상대", undefined, 0);
    room.setReady("host", true); room.setReady("other", true); room.setMafiaCount("host", 1); room.startGame("host", 0);
    const before = room.snapshot().players.find((player) => player.id === "other")!.position;
    expect(room.move("other", { x: 1, z: 0 }, 0, false, 100, 1, false, true)).toBeUndefined();
    expect(room.snapshot().players.find((player) => player.id === "other")!.position).toEqual(before);
  });

  it("90초 회의에서 생존자 채팅과 투표를 기록하고 종료 시 서버가 집계한다", () => {
    const room = new GameRoom("test");
    for (const id of ["host", "survivor-a", "survivor-b", "survivor-c"]) { room.join(id, id, undefined, 0); room.setReady(id, true); }
    room.setMafiaCount("host", 1); room.startGame("host", 0);
    expect(() => room.callMeeting("host", 1_000)).toThrow("긴급 회의 종");
    room.teleport("host", EMERGENCY_BELL_POSITION);
    room.callMeeting("host", 1_000);
    room.chat("host", "발견 위치를 확인해 주세요", 1_000);
    room.vote("host", "SKIP");
    expect(room.snapshot().meeting).toMatchObject({ endsAt: 91_000, messages: [expect.objectContaining({ text: "발견 위치를 확인해 주세요" })], votes: { host: "SKIP" } });
    expect(room.advance(90_999)).toBe(false);
    expect(room.advance(91_000)).toBe(true);
    expect(room.snapshot().meetingResult).toMatchObject({ type: "SKIP", endsAt: 94_000 });
    expect(room.advance(94_000)).toBe(true);
    expect(room.snapshot().gameState).toBe("PLAYING");
  });

  it("생존자 과반의 건너뛰기 투표는 즉시 결과 연출로 넘어간다", () => {
    const room = new GameRoom("test");
    for (const id of ["host", "survivor-a", "survivor-b", "survivor-c"]) { room.join(id, id, undefined, 0); room.setReady(id, true); }
    room.setMafiaCount("host", 1); room.startGame("host", 0); room.teleport("host", EMERGENCY_BELL_POSITION); room.callMeeting("host", 1_000);
    room.vote("host", "SKIP", 1_100); room.vote("survivor-a", "SKIP", 1_200); room.vote("survivor-b", "SKIP", 1_300);
    expect(room.snapshot()).toMatchObject({ gameState: "VOTING", meetingResult: { type: "SKIP", endsAt: 4_300 } });
  });

  it("인원 변화가 없는 긴급 회의를 건너뛰면 낮은 인원 방에서도 게임으로 돌아간다", () => {
    const room = new GameRoom("test");
    room.join("host", "마피아", undefined, 0); room.join("survivor", "시민", undefined, 0);
    room.setReady("host", true); room.setReady("survivor", true); room.setMafiaCount("host", 1); room.startGame("host", 0);
    room.teleport("host", EMERGENCY_BELL_POSITION); room.callMeeting("host", 1_000);
    room.vote("host", "SKIP", 1_100); room.vote("survivor", "SKIP", 1_200);
    expect(room.snapshot()).toMatchObject({ gameState: "VOTING", meetingResult: { type: "SKIP" } });
    expect(room.advance(4_200)).toBe(true);
    expect(room.snapshot()).toMatchObject({ gameState: "PLAYING", meetingResult: undefined, result: undefined });
  });

  it("사망한 참가자도 투표 대상에 포함하고 최다 득표자는 결과 뒤 처형한다", () => {
    const room = new GameRoom("test");
    for (const id of ["host", "survivor-a", "survivor-b"]) { room.join(id, id, undefined, 0); room.setReady(id, true); }
    room.setMafiaCount("host", 1); room.startGame("host", 0); room.teleport("host", EMERGENCY_BELL_POSITION); room.teleport("survivor-b", { x: 14, y: 1.4, z: 9 }); room.callMeeting("host", 1_000);
    room.vote("host", "survivor-a", 1_100); room.vote("survivor-a", "survivor-a", 1_200); room.vote("survivor-b", "host", 1_300);
    room.advance(91_000);
    expect(room.snapshot().meetingResult).toMatchObject({ type: "EXPEL", expelledId: "survivor-a" });
    room.advance(94_000);
    expect(room.snapshot().players.find((player) => player.id === "survivor-a")?.lifeState).toBe("GHOST");
    expect(room.snapshot()).toMatchObject({ gameState: "GAME_OVER", result: { winner: "MAFIA" }, players: expect.arrayContaining([expect.objectContaining({ id: "host", position: EMERGENCY_BELL_POSITION }), expect.objectContaining({ id: "survivor-b", position: { x: 14, y: 1.4, z: 9 } })]) });
  });

  it("공통 임무 완료는 서버가 시민 승리로 확정한다", () => {
    const room = new GameRoom("test");
    room.join("host", "마피아", undefined, 0); room.join("survivor", "시민", undefined, 0);
    room.setReady("host", true); room.setReady("survivor", true); room.setMafiaCount("host", 1); room.startGame("host", 0);
    room.completeTaskVictory();
    expect(room.snapshot()).toMatchObject({ gameState: "GAME_OVER", result: { winner: "SURVIVOR" } });
  });

  it("유예 시간 안에는 재접속 상태를 복구한다", () => {
    const room = new GameRoom("test");
    const joined = room.join("before", "기존", undefined, 0);
    room.disconnect("before", 100);
    room.join("after", "복귀", joined.resumeToken, 10_000);
    expect(room.snapshot().players).toHaveLength(1);
    expect(room.snapshot().players[0].displayName).toBe("복귀");
  });

  it("기존 연결 종료보다 새 연결이 먼저 와도 토큰 세션을 교체한다", () => {
    const room = new GameRoom("test");
    const joined = room.join("before", "기존", undefined, 0);
    room.join("after", "새 연결", joined.resumeToken, 100);
    expect(room.snapshot().players).toEqual([expect.objectContaining({ id: "after", displayName: "새 연결", connected: true })]);
  });

  it("방장 연결이 끊기면 접속 중인 다음 참가자에게 방장을 넘긴다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    room.join("next", "다음", undefined, 0);
    expect(room.disconnect("host", 100)).toBe(true);
    expect(room.snapshot().hostId).toBe("next");
  });

  it("방장이 같은 토큰으로 연결을 교체하면 새 식별자에 방장 권한을 유지한다", () => {
    const room = new GameRoom("test");
    const joined = room.join("before", "방장", undefined, 0);
    room.join("after", "복귀 방장", joined.resumeToken, 100);
    expect(room.snapshot()).toMatchObject({ hostId: "after", players: [expect.objectContaining({ id: "after" })] });
  });

  it("재접속하면 새 클라이언트의 이동 순번을 0부터 다시 받는다", () => {
    const room = new GameRoom("test");
    const joined = room.join("before", "기존", undefined, 0);
    room.join("other", "상대", undefined, 0);
    room.setReady("before", true); room.setReady("other", true); room.setMafiaCount("before", 1); room.startGame("before", 0);
    expect(room.move("before", { x: 1, z: 0 }, 0, false, 100, 500)).toBeDefined();
    room.disconnect("before", 200);
    room.join("after", "복귀", joined.resumeToken, 300);
    expect(room.move("after", { x: 1, z: 0 }, 0, false, 400, 0)).toBeDefined();
  });

  it("빈 표시 이름에는 친근한 무작위 별명을 부여한다", () => {
    const room = new GameRoom("test");
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    room.join("host", "", undefined, 0);
    random.mockRestore();
    expect(room.snapshot().players[0].displayName).toBe("배고픈 비버");
  });

  it("방장이 연결을 끊으면 서버가 연결 해제를 알리고 다음 참가자에게 권한을 넘긴다", () => {
    const room = new GameRoom("test");
    room.join("host", "방장", undefined, 0);
    room.join("other", "상대", undefined, 0);
    expect(room.disconnect("host", 100)).toBe(true);
    expect(room.snapshot()).toMatchObject({ hostId: "other", players: [{ id: "host", connected: false }, { id: "other", connected: true }] });
  });
});
