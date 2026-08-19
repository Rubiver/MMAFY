import { getActiveGameClient } from "../network/gameClient";
import { useGameStore } from "../store/gameStore";

/** 역할별 행동과 회의 투표 요청을 서버에 보낸다. */
export function GameActions() {
  const room = useGameStore((state) => state.room); const id = useGameStore((state) => state.playerId); const role = useGameStore((state) => state.role);
  if (!room || !id) return null;
  const me = room.players.find((player) => player.id === id); const living = room.players.filter((player) => player.lifeState === "ALIVE" && player.id !== id);
  return <aside className="fixed bottom-4 left-4 right-4 z-10 flex flex-wrap gap-2 rounded-xl bg-slate-950/90 p-3 text-sm text-white sm:left-auto sm:w-[420px]"><span className="mr-auto self-center">역할: <b className={role === "MAFIA" ? "text-rose-300" : "text-cyan-300"}>{role === "MAFIA" ? "마피아" : "생존자"}</b></span>{room.gameState === "PLAYING" && me?.lifeState === "ALIVE" ? <><button onClick={() => getActiveGameClient()?.callMeeting()} className="rounded bg-amber-500 px-3 py-2 text-slate-950">긴급 회의</button>{role === "MAFIA" ? living.map((player) => <button key={player.id} onClick={() => getActiveGameClient()?.kill(player.id)} className="rounded bg-rose-600 px-3 py-2">{player.displayName} 처치</button>) : null}</> : null}{room.gameState === "MEETING" && room.hostId === id ? <button onClick={() => getActiveGameClient()?.startVoting()} className="rounded bg-cyan-500 px-3 py-2 text-slate-950">투표 시작</button> : null}{room.gameState === "VOTING" && me?.lifeState === "ALIVE" ? <>{living.map((player) => <button key={player.id} onClick={() => getActiveGameClient()?.vote(player.id)} className="rounded bg-slate-700 px-3 py-2">{player.displayName} 투표</button>)}<button onClick={() => getActiveGameClient()?.vote("SKIP")} className="rounded bg-slate-700 px-3 py-2">건너뛰기</button></> : null}{room.gameState === "GAME_OVER" ? <b className="w-full text-center text-amber-200">{room.result?.winner === "MAFIA" ? "마피아 승리" : "생존자 승리"}</b> : null}</aside>;
}
