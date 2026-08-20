import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@mafia/shared";
import { EnvironmentSystem } from "./environment.js";
import { GameRoom, RoomError } from "./room.js";

type RoomEntry = { room: GameRoom; environment: EnvironmentSystem };
type SocketEntry = { playerId: string; roomCode: string };

const port = Number(process.env.PORT ?? 2567);
const rooms = new Map<string, RoomEntry>();
const sockets = new Map<WebSocket, SocketEntry>();
let playerCount = 0;

const server = createServer((_request, response) => { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ status: "ok", rooms: [...rooms.keys()] })); });
const websocketServer = new WebSocketServer({ server });

/** 같은 방의 접속자에게 권한형 방 상태를 전파한다. */
function broadcastState(roomCode: string): void { const entry = getRoom(roomCode); const message: ServerMessage = { type: "ROOM_STATE", snapshot: entry.room.snapshot() }; for (const [socket, item] of sockets) if (item.roomCode === roomCode) send(socket, message); }
/** 같은 방의 접속자에게 환경 상태를 전파한다. */
function broadcastEnvironment(roomCode: string): void { const entry = getRoom(roomCode); const message: ServerMessage = { type: "ENVIRONMENT_STATE", environment: entry.environment.snapshot() }; for (const [socket, item] of sockets) if (item.roomCode === roomCode) send(socket, message); }
/** 직렬화 가능한 서버 메시지를 안전하게 전송한다. */
function send(socket: WebSocket, message: ServerMessage): void { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message)); }

websocketServer.on("connection", (socket) => {
  const playerId = `player-${++playerCount}`;
  socket.on("message", (raw) => {
    try {
      const message = parseMessage(raw.toString());
      if (message.type === "CREATE_ROOM") {
        const roomCode = createRoomCode(); const entry: RoomEntry = { room: new GameRoom(roomCode), environment: new EnvironmentSystem() }; rooms.set(roomCode, entry); join(socket, playerId, roomCode, message.displayName, undefined);
      } else if (message.type === "JOIN") join(socket, playerId, normalizeRoomCode(message.roomCode), message.displayName, message.resumeToken);
      else {
        const session = requireSession(socket); const entry = getRoom(session.roomCode); const room = entry.room; const now = Date.now();
        if (message.type === "SET_READY") { room.setReady(session.playerId, message.ready); broadcastState(session.roomCode); }
        else if (message.type === "START_GAME") { entry.environment.reset(); room.startGame(session.playerId, now); broadcastState(session.roomCode); broadcastEnvironment(session.roomCode); for (const [peer, item] of sockets) if (item.roomCode === session.roomCode) { send(peer, { type: "ROLE", ...room.roleInfo(item.playerId) }); sendKillCooldown(peer, room, item.playerId, now); } }
        else if (message.type === "SET_MAFIA_COUNT") { room.setMafiaCount(session.playerId, message.count); broadcastState(session.roomCode); }
        else if (message.type === "KILL") { room.kill(session.playerId, message.targetId, now); sendKillCooldown(socket, room, session.playerId, now); broadcastState(session.roomCode); }
        else if (message.type === "REPORT") { room.report(session.playerId, message.bodyId); broadcastState(session.roomCode); }
        else if (message.type === "CALL_MEETING") { room.callMeeting(session.playerId); broadcastState(session.roomCode); }
        else if (message.type === "START_VOTING") { room.startVoting(session.playerId); broadcastState(session.roomCode); }
        else if (message.type === "VOTE") { room.vote(session.playerId, message.targetId); broadcastState(session.roomCode); }
        else if (message.type === "MOVE") { const position = room.move(session.playerId, message.direction, message.rotation, message.run, now, message.sequence); if (position) { send(socket, { type: "MOVE_ACK", sequence: message.sequence, position }); broadcastState(session.roomCode); } }
        else if (message.type === "ENVIRONMENT") { const player = room.snapshot().players.find((item) => item.id === session.playerId); if (!player || room.snapshot().gameState !== "PLAYING" || player.lifeState !== "ALIVE") throw new RoomError("INVALID_MESSAGE", "환경 장치를 사용할 수 없습니다."); const team = room.roleInfo(session.playerId).team; if (message.action === "SABOTAGE" && message.deviceId) entry.environment.sabotage(session.playerId, team, message.deviceId, now); else if (message.action === "REPAIR_START" && message.deviceId) entry.environment.startRepair(session.playerId, team, message.deviceId, player.position, now); else if (message.action === "REPAIR_COMPLETE" && message.deviceId) entry.environment.completeRepair(session.playerId, team, message.deviceId, player.position, now); else if (message.action === "REPAIR_CANCEL") entry.environment.cancelRepair(session.playerId); else if (message.action === "TASK") entry.environment.completeTask(team, player.position); else if (message.action === "VENT") room.teleport(session.playerId, entry.environment.useVent(team, player.position)); else throw new RoomError("INVALID_MESSAGE", "환경 장치 대상이 올바르지 않습니다."); broadcastEnvironment(session.roomCode); broadcastState(session.roomCode); }
        else send(socket, { type: "PONG" });
      }
    } catch (error) { const roomError = error instanceof RoomError ? error : new RoomError("INVALID_MESSAGE", "요청 형식이 올바르지 않습니다."); send(socket, { type: "ERROR", code: roomError.code, message: roomError.message }); }
  });
  socket.on("close", () => { const session = sockets.get(socket); sockets.delete(socket); if (session) { const entry = rooms.get(session.roomCode); if (entry) { entry.room.disconnect(session.playerId, Date.now()); broadcastState(session.roomCode); } } });
});

/** 방 입장 또는 재접속을 처리하고 해당 방 상태를 전파한다. */
function join(socket: WebSocket, playerId: string, roomCode: string, displayName: string, resumeToken: string | undefined): void { const entry = getRoom(roomCode); const now = Date.now(); const joined = entry.room.join(playerId, displayName, resumeToken, now); sockets.set(socket, { playerId, roomCode }); send(socket, { type: "WELCOME", playerId, resumeToken: joined.resumeToken, snapshot: joined.snapshot }); send(socket, { type: "ENVIRONMENT_STATE", environment: entry.environment.snapshot() }); if (joined.snapshot.gameState === "PLAYING") { send(socket, { type: "ROLE", ...entry.room.roleInfo(playerId) }); sendKillCooldown(socket, entry.room, playerId, now); } broadcastState(roomCode); }
/** 지정 참가자에게만 처치 재사용 대기 시간을 알린다. */
function sendKillCooldown(socket: WebSocket, room: GameRoom, playerId: string, now: number): void { send(socket, { type: "KILL_COOLDOWN", remainingMs: room.killCooldownRemainingMs(playerId, now) }); }
/** 코드에 해당하는 방을 반환한다. */
function getRoom(roomCode: string): RoomEntry { const entry = rooms.get(roomCode); if (!entry) throw new RoomError("INVALID_MESSAGE", "방 코드를 찾을 수 없습니다."); return entry; }
/** 연결한 참가자의 방 세션을 반환한다. */
function requireSession(socket: WebSocket): SocketEntry { const session = sockets.get(socket); if (!session) throw new RoomError("INVALID_MESSAGE", "먼저 방에 입장해야 합니다."); return session; }
/** 충돌하지 않는 여섯 글자 영문·숫자 방 코드를 만든다. */
function createRoomCode(): string { let code = ""; do code = Math.random().toString(36).slice(2, 8).toUpperCase(); while (rooms.has(code)); return code; }
/** 사용자가 입력한 방 코드를 안전한 대문자 형식으로 바꾼다. */
function normalizeRoomCode(value: string): string { return value.trim().toUpperCase(); }

setInterval(() => { for (const [roomCode, entry] of rooms) { entry.room.pruneDisconnected(Date.now()); if (entry.room.snapshot().players.length === 0) rooms.delete(roomCode); } }, 5_000).unref();
server.listen(port, () => console.log(`게임 서버가 ${port} 포트에서 실행 중입니다.`));

/** 허용한 메시지 유형만 해석한다. @throws 형식이 올바르지 않은 경우 */
function parseMessage(raw: string): ClientMessage {
  const value: unknown = JSON.parse(raw); if (!value || typeof value !== "object" || !("type" in value) || typeof value.type !== "string") throw new RoomError("INVALID_MESSAGE", "요청 형식이 올바르지 않습니다.");
  if (value.type === "CREATE_ROOM" && typeof value.displayName === "string") return value as ClientMessage;
  if (value.type === "JOIN" && typeof value.displayName === "string" && typeof value.roomCode === "string" && (value.resumeToken === undefined || typeof value.resumeToken === "string")) return value as ClientMessage;
  if (value.type === "SET_READY" && typeof value.ready === "boolean") return value as ClientMessage;
  if (value.type === "SET_MAFIA_COUNT" && Number.isInteger(value.count)) return value as ClientMessage;
  if (value.type === "KILL" && typeof value.targetId === "string") return value as ClientMessage;
  if (value.type === "REPORT" && typeof value.bodyId === "string") return value as ClientMessage;
  if (value.type === "CALL_MEETING" || value.type === "START_VOTING" || value.type === "START_GAME" || value.type === "PING") return value;
  if (value.type === "VOTE" && typeof value.targetId === "string") return value as ClientMessage;
  if (value.type === "ENVIRONMENT" && ["SABOTAGE", "REPAIR_START", "REPAIR_COMPLETE", "REPAIR_CANCEL", "VENT", "TASK"].includes(String(value.action)) && (value.deviceId === undefined || value.deviceId === "generator-a" || value.deviceId === "generator-b")) return value as ClientMessage;
  if (value.type === "MOVE" && value.direction && typeof value.direction === "object" && "x" in value.direction && "z" in value.direction && Number.isFinite(value.direction.x) && Number.isFinite(value.direction.z) && Number.isFinite(value.rotation) && typeof value.run === "boolean" && Number.isInteger(value.sequence)) return value as ClientMessage;
  throw new RoomError("INVALID_MESSAGE", "요청 형식이 올바르지 않습니다.");
}
