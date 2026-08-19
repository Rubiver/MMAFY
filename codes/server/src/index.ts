import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@mafia/shared";
import { GameRoom, RoomError } from "./room.js";

const port = Number(process.env.PORT ?? 2567);
const room = new GameRoom("lobby-01");
const sockets = new Map<WebSocket, string>();
let playerCount = 0;

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: "ok", room: room.snapshot() }));
});
const websocketServer = new WebSocketServer({ server });

/** 모든 접속자에 최신 서버 권한 상태를 전파한다. */
function broadcastState(): void {
  const message: ServerMessage = { type: "ROOM_STATE", snapshot: room.snapshot() };
  for (const socket of sockets.keys()) send(socket, message);
}

/** 직렬화 가능한 서버 메시지를 안전하게 전송한다. */
function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

websocketServer.on("connection", (socket) => {
  const playerId = `player-${++playerCount}`;
  socket.on("message", (raw) => {
    try {
      const message = parseMessage(raw.toString());
      if (message.type === "JOIN") {
        const joined = room.join(playerId, message.displayName, message.resumeToken, Date.now());
        sockets.set(socket, playerId);
        send(socket, { type: "WELCOME", playerId, resumeToken: joined.resumeToken, snapshot: joined.snapshot });
        broadcastState();
      } else if (message.type === "SET_READY") {
        room.setReady(requirePlayer(socket), message.ready);
        broadcastState();
      } else if (message.type === "START_GAME") {
        room.startGame(requirePlayer(socket));
        broadcastState();
        for (const [peer, id] of sockets) send(peer, { type: "ROLE", ...room.roleInfo(id) });
      } else if (message.type === "SET_MAFIA_COUNT") {
        room.setMafiaCount(requirePlayer(socket), message.count); broadcastState();
      } else if (message.type === "KILL") {
        room.kill(requirePlayer(socket), message.targetId, Date.now()); broadcastState();
      } else if (message.type === "REPORT") {
        room.report(requirePlayer(socket), message.bodyId); broadcastState();
      } else if (message.type === "CALL_MEETING") {
        room.callMeeting(requirePlayer(socket)); broadcastState();
      } else if (message.type === "START_VOTING") {
        room.startVoting(requirePlayer(socket)); broadcastState();
      } else if (message.type === "VOTE") {
        room.vote(requirePlayer(socket), message.targetId); broadcastState();
      } else if (message.type === "MOVE") {
        if (room.move(requirePlayer(socket), message.direction, message.rotation, Date.now())) broadcastState();
      } else send(socket, { type: "PONG" });
    } catch (error) {
      const roomError = error instanceof RoomError ? error : new RoomError("INVALID_MESSAGE", "요청 형식이 올바르지 않습니다.");
      send(socket, { type: "ERROR", code: roomError.code, message: roomError.message });
    }
  });
  socket.on("close", () => {
    const id = sockets.get(socket);
    sockets.delete(socket);
    if (id) {
      room.disconnect(id, Date.now());
      broadcastState();
    }
  });
});

setInterval(() => { room.pruneDisconnected(Date.now()); }, 5_000).unref();
server.listen(port, () => console.log(`게임 서버가 ${port} 포트에서 실행 중입니다.`));

/** 연결한 참가자 식별자를 반환한다. @throws 아직 입장하지 않은 경우 */
function requirePlayer(socket: WebSocket): string {
  const playerId = sockets.get(socket);
  if (!playerId) throw new RoomError("INVALID_MESSAGE", "먼저 방에 입장해야 합니다.");
  return playerId;
}

/** 허용한 메시지 유형만 해석한다. @throws 형식이 올바르지 않은 경우 */
function parseMessage(raw: string): ClientMessage {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("type" in value) || typeof value.type !== "string") throw new RoomError("INVALID_MESSAGE", "요청 형식이 올바르지 않습니다.");
  if (value.type === "JOIN" && typeof value.displayName === "string" && (value.resumeToken === undefined || typeof value.resumeToken === "string")) return value as ClientMessage;
  if (value.type === "SET_READY" && typeof value.ready === "boolean") return value as ClientMessage;
  if (value.type === "SET_MAFIA_COUNT" && Number.isInteger(value.count)) return value as ClientMessage;
  if (value.type === "KILL" && typeof value.targetId === "string") return value as ClientMessage;
  if (value.type === "REPORT" && typeof value.bodyId === "string") return value as ClientMessage;
  if (value.type === "CALL_MEETING" || value.type === "START_VOTING") return value;
  if (value.type === "VOTE" && typeof value.targetId === "string") return value as ClientMessage;
  if (value.type === "START_GAME" || value.type === "PING") return value;
  if (value.type === "MOVE" && value.direction && typeof value.direction === "object" && "x" in value.direction && "z" in value.direction && Number.isFinite(value.direction.x) && Number.isFinite(value.direction.z) && Number.isFinite(value.rotation) && Number.isInteger(value.sequence)) return value as ClientMessage;
  throw new RoomError("INVALID_MESSAGE", "요청 형식이 올바르지 않습니다.");
}
