import { getActiveGameClient } from "../network/gameClient";
import { useGameStore } from "../store/gameStore";

/** 역할별 행동과 회의 투표 요청을 서버에 보낸다. */
export function GameActions() {
  const room = useGameStore((state) => state.room); const id = useGameStore((state) => state.playerId); const role = useGameStore((state) => state.role);
  const environment = useGameStore((state) => state.environment);
  if (!room || !id) return null;
  const me = room.players.find((player) => player.id === id); const living = room.players.filter((player) => player.lifeState === "ALIVE" && player.id !== id);
  return <aside className="fixed bottom-4 left-4 right-4 z-10 flex flex-wrap gap-2 rounded-xl bg-slate-950/90 p-3 text-sm text-white sm:left-auto sm:w-[420px]"><span className="mr-auto self-center">역할: <b className={role === "MAFIA" ? "text-rose-300" : "text-cyan-300"}>{role === "MAFIA" ? "마피아" : "생존자"}</b> {environment?.blackout ? "· 정전" : "· 전력 정상"}</span>{room.gameState === "PLAYING" && me?.lifeState === "ALIVE" ? <><button onClick={() => getActiveGameClient()?.callMeeting()} className="rounded bg-amber-500 px-3 py-2 text-slate-950">긴급 회의</button>{role === "MAFIA" ? <><button title="발전기 A 근처에서만 사용" onClick={() => getActiveGameClient()?.environment("SABOTAGE")} className="rounded bg-rose-600 px-3 py-2">발전기 A에서 정전</button><button title="환풍구 입구 근처에서만 사용" onClick={() => getActiveGameClient()?.environment("VENT")} className="rounded bg-purple-600 px-3 py-2">환풍구</button></> : <><button title="발전기 A 근처에서만 사용" onClick={() => getActiveGameClient()?.environment("REPAIR")} className="rounded bg-emerald-600 px-3 py-2">발전기 A 복구</button><button title="발전기 A 근처에서만 사용" onClick={() => getActiveGameClient()?.environment("TASK")} className="rounded bg-sky-600 px-3 py-2">공동 임무 {environment?.taskProgress ?? 0}%</button></>}</> : null}</aside>;
}
