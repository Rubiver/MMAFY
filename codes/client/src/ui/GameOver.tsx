import { getActiveGameClient } from "../network/gameClient";
import { useGameStore } from "../store/gameStore";

/** 서버가 확정한 승자와 현재 참가자의 승패를 보여 주고 다음 판 준비를 안내한다.
 * @returns 서버 승리 결과와 대기실 복귀 안내 화면
 */
export function GameOver() {
  const room = useGameStore((state) => state.room);
  const playerId = useGameStore((state) => state.playerId);
  const role = useGameStore((state) => state.role);
  if (!room?.result) return null;

  const isHost = room.hostId === playerId;
  const won = role === room.result.winner;
  const winnerName = room.result.winner === "MAFIA" ? "마피아" : "생존자";
  const accent = won ? "text-emerald-300" : "text-rose-300";

  return (
    <main className="flex min-h-screen items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_top,_#172554,_#020617_58%)] px-5 py-10 text-slate-100">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-600/70 bg-slate-950/90 p-6 text-center shadow-2xl shadow-black/50 sm:p-10">
        <p className="text-xs font-bold tracking-[0.24em] text-amber-300">게임 종료</p>
        <h1 className={`mt-5 text-5xl font-black sm:text-7xl ${accent}`}>{won ? "승리" : "패배"}</h1>
        <p className="mt-5 text-xl font-bold sm:text-2xl">{winnerName} 진영이 승리했습니다.</p>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">
          서버가 최종 결과를 확정했습니다. 다음 판에서는 역할, 생명 상태, 시체, 임무와 시설 상태가 모두 초기화됩니다.
        </p>
        <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-left sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-400">승리 진영</span>
            <b className={room.result.winner === "MAFIA" ? "text-rose-300" : "text-cyan-300"}>{winnerName}</b>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-700 pt-3">
            <span className="text-sm text-slate-400">내 역할</span>
            <b>{role === "MAFIA" ? "마피아" : "생존자"}</b>
          </div>
        </div>
        {isHost ? (
          <button type="button" onClick={() => getActiveGameClient()?.resetGame()} className="mt-8 w-full rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 sm:w-auto">
            대기실로 돌아가기
          </button>
        ) : (
          <p className="mt-8 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-300">방장이 다음 게임을 준비할 때까지 기다려 주세요.</p>
        )}
      </section>
    </main>
  );
}
