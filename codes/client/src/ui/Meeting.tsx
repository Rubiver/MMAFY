import { useEffect, useState } from "react";
import { getActiveGameClient } from "../network/gameClient";
import { useGameStore } from "../store/gameStore";

/** 신고 뒤 90초 동안 채팅과 투표를 함께 진행하는 회의 화면이다.
 * @returns 회의 화면 또는 없음
 */
export function Meeting() {
  const room = useGameStore((state) => state.room);
  const playerId = useGameStore((state) => state.playerId);
  const [text, setText] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, []);
  if (!room || !playerId) return null;
  if (room.meetingResult) return <MeetingResultScreen />;
  if (!room.meeting) return null;
  const { meeting } = room;
  const me = room.players.find((player) => player.id === playerId);
  const communicationsOnline = useGameStore((state) => state.environment?.communicationsOnline ?? true);
  const reporter = room.players.find((player) => player.id === meeting.reporterId);
  const votePlayers = room.players;
  const remaining = Math.max(0, Math.ceil((meeting.endsAt - now) / 1000));
  const votedFor = meeting.votes[playerId];
  const send = () => { if (!communicationsOnline || !text.trim()) return; getActiveGameClient()?.chat(text); setText(""); };
  return <main className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-slate-100 sm:px-8 sm:py-8"><section className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-3xl border border-amber-200/30 bg-slate-900 p-5 shadow-2xl sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.18em] text-amber-300">긴급 토론</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{meeting.bodyId ? "시체가 신고되었습니다" : "긴급 회의가 소집되었습니다"}</h1><p className="mt-2 text-sm text-slate-300">신고자: {reporter?.displayName ?? "알 수 없음"} · 토론과 투표를 동시에 진행합니다.</p></div><div className="rounded-2xl border border-rose-300/40 bg-rose-950/60 px-4 py-3 text-center"><b className="block text-2xl tabular-nums text-rose-100">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</b><span className="text-xs text-rose-200">남은 회의 시간</span></div></div><div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-4"><div className="flex items-center justify-between"><h2 className="font-bold">회의 채팅</h2><span className="text-xs text-slate-400">생존자만 발언 가능</span></div><div className="mt-3 h-72 space-y-2 overflow-y-auto rounded-xl bg-slate-900/70 p-3" aria-live="polite">{meeting.messages.length ? meeting.messages.map((message) => <p key={message.id} className="break-words text-sm"><b className="mr-2 text-cyan-200">{message.displayName}</b><span className="text-slate-200">{message.text}</span></p>) : <p className="text-sm text-slate-500">아직 메시지가 없습니다. 상황을 공유하고 의심 대상을 논의하세요.</p>}</div>{me?.lifeState === "ALIVE" ? <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); send(); }}><input aria-label="회의 채팅" value={text} maxLength={160} onChange={(event) => setText(event.target.value)} placeholder="메시지 입력" className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring" /><button type="submit" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950">전송</button></form> : <p className="mt-3 text-sm text-rose-300">사망한 참가자는 채팅과 투표를 할 수 없습니다.</p>}</div></div><aside className="rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7"><h2 className="text-xl font-bold">투표</h2><p className="mt-1 text-sm text-slate-400">전체 참가자를 대상으로 투표합니다. 생존자 과반이 건너뛰기를 고르면 즉시 종료됩니다.</p><div className="mt-5 space-y-2">{votePlayers.map((player) => <button key={player.id} type="button" disabled={Boolean(votedFor) || me?.lifeState !== "ALIVE"} onClick={() => getActiveGameClient()?.vote(player.id)} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${votedFor === player.id ? "bg-rose-600 text-white" : player.lifeState === "ALIVE" ? "bg-slate-800 hover:bg-slate-700" : "bg-rose-950/50 text-rose-200 hover:bg-rose-900/60"}`}><span>{player.displayName} {player.lifeState !== "ALIVE" ? "· 처치됨" : ""}</span><span className="text-xs">{votedFor === player.id ? "투표함" : "투표"}</span></button>)}<button type="button" disabled={Boolean(votedFor) || me?.lifeState !== "ALIVE"} onClick={() => getActiveGameClient()?.vote("SKIP")} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${votedFor === "SKIP" ? "bg-slate-500 text-white" : "bg-slate-800 hover:bg-slate-700"}`}><span>건너뛰기</span><span className="text-xs">투표</span></button></div>{votedFor ? <p className="mt-4 rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-200">투표를 기록했습니다. 회의 종료까지 채팅으로 토론할 수 있습니다.</p> : null}</aside></section></main>;
}

/** 서버가 확정한 회의 결과를 글자 단위로 보여 준다. */
function MeetingResultScreen() {
  const room = useGameStore((state) => state.room);
  const [length, setLength] = useState(0);
  const result = room?.meetingResult;
  const expelled = result?.expelledId ? room?.players.find((player) => player.id === result.expelledId) : undefined;
  const message = result?.type === "EXPEL" ? `${expelled?.displayName ?? "참가자"} 님이 처형됩니다.` : "회의를 건너뜁니다.";
  useEffect(() => { setLength(0); const timer = window.setInterval(() => setLength((value) => Math.min(message.length, value + 1)), 55); return () => window.clearInterval(timer); }, [message]);
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-slate-100"><section className="w-full max-w-xl rounded-3xl border border-amber-200/35 bg-slate-900 p-8 text-center shadow-2xl"><p className="text-xs font-bold tracking-[0.2em] text-amber-300">회의 결과</p><h1 className="mt-5 min-h-20 text-3xl font-bold leading-relaxed sm:text-4xl">{message.slice(0, length)}<span className="animate-pulse text-amber-300">|</span></h1><p className="mt-5 text-sm text-slate-400">서버가 다음 라운드를 준비하고 있습니다.</p></section></main>;
}
