import { useEffect, useState } from "react";
import type { GeneratorId } from "@mafia/shared";
import { getActiveGameClient } from "../network/gameClient";
import { useGameStore } from "../store/gameStore";

/** Caps Lock을 누르는 동안 열리는 마피아 전용 시설 사보타지 지도다.
 * @param held Caps Lock 키 유지 여부
 * @param blackout 현재 정전 여부
 * @param onSabotage 발전기 고장 요청 처리
 * @returns 시설 선택 지도 또는 없음
 */
function SabotageMap({ held, blackout, onSabotage }: { held: boolean; blackout: boolean; onSabotage: (generatorId: GeneratorId) => void }) {
  if (!held) return null;
  const points: { id: GeneratorId; name: string; location: string; position: string }[] = [{ id: "generator-a", name: "발전기 A", location: "서쪽 전력실", position: "left-[15%] top-[62%]" }, { id: "generator-b", name: "발전기 B", location: "동쪽 전력실", position: "right-[12%] top-[28%]" }];
  return <section className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/45 p-3 sm:p-6" aria-label="사보타지 시설 지도"><div className="w-full max-w-2xl rounded-3xl border border-rose-300/40 bg-slate-950/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-md sm:p-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold tracking-[0.16em] text-rose-300 sm:text-xs sm:tracking-[0.2em]">CAPS 유지 중 · 마피아 전용</p><h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">시설 원격 방해공작</h2></div><span className="shrink-0 whitespace-nowrap rounded-full border border-rose-200/30 bg-rose-500/15 px-3 py-1 text-[10px] font-semibold text-rose-100 sm:text-xs">Caps를 놓으면 닫힘</span></div><p className="mt-2 text-sm text-slate-300">고장 낼 발전기 표식을 클릭하세요. 정전 중에는 다른 시설을 선택할 수 없습니다.</p><div className="relative mt-5 h-64 overflow-hidden rounded-2xl border border-slate-700 bg-[radial-gradient(circle_at_70%_35%,#23384d_0,transparent_20%),linear-gradient(135deg,#101c2a,#071018)] sm:h-80"><div className="absolute inset-x-10 top-1/2 h-px bg-cyan-200/15" /><div className="absolute bottom-7 left-1/2 top-7 w-px bg-cyan-200/15" /><span className="absolute bottom-4 left-4 text-xs text-slate-500">서쪽 전력실</span><span className="absolute right-4 top-4 text-xs text-slate-500">동쪽 전력실</span>{points.map((point) => <button key={point.id} type="button" disabled={blackout} onClick={() => onSabotage(point.id)} className={`absolute ${point.position} -translate-x-1/2 -translate-y-1/2 rounded-xl border border-rose-200/60 bg-rose-600 px-3 py-2 text-left text-white shadow-lg shadow-rose-950/50 transition hover:scale-105 hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-400`}><span className="block text-base leading-none" aria-hidden="true">⚡</span><b className="mt-1 block text-xs">{point.name}</b><small className="block text-[10px] text-rose-100">{point.location}</small></button>)}</div></div></section>;
}

/** 마피아만 볼 수 있는 처치 재사용 대기 아이콘과 남은 시간을 표시한다.
 * @returns 처치 준비 상태 표시 또는 없음
 */
function KillCooldownIndicator() {
  const role = useGameStore((state) => state.role);
  const cooldownUntil = useGameStore((state) => state.killCooldownUntil ?? 0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 100); return () => window.clearInterval(timer); }, []);
  if (role !== "MAFIA") return null;
  const remainingMs = Math.max(0, cooldownUntil - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const ready = seconds === 0;
  return <aside className={`pointer-events-none fixed bottom-5 right-5 z-10 flex h-20 w-20 flex-col items-center justify-center rounded-2xl border shadow-2xl backdrop-blur-md sm:bottom-6 sm:right-6 ${ready ? "border-rose-200/70 bg-rose-600/90 text-white" : "border-slate-400/40 bg-slate-950/90 text-slate-200"}`} aria-label={ready ? "처치 가능" : `처치까지 ${seconds}초`}><span className="text-2xl leading-none" aria-hidden="true">✕</span><span className="mt-1 text-xs font-bold">{ready ? "처치 가능" : `${seconds}초`}</span></aside>;
}

/** 크로스헤어에서 발전기 복구 유지 시간을 시각적으로 표시한다. */
function RepairProgressIndicator() {
  const progress = useGameStore((state) => state.repairProgress);
  if (progress <= 0) return null;
  return <div className="pointer-events-none fixed left-1/2 top-1/2 z-20 w-44 -translate-x-1/2 translate-y-7" aria-label={`발전기 복구 진행 ${Math.round(progress * 100)}퍼센트`}><div className="mb-1 flex justify-between text-[11px] font-bold text-amber-100"><span>발전기 복구 중</span><span>{Math.ceil((1 - progress) * 3)}초</span></div><div className="h-2 overflow-hidden rounded-full border border-amber-200/60 bg-slate-950/80"><div className="h-full rounded-full bg-amber-400 transition-[width] duration-75" style={{ width: `${progress * 100}%` }} /></div></div>;
}

/** 사보타지 지도를 닫은 직후 게임 캔버스에 포커스와 포인터 잠금을 되돌린다. */
function restoreGamePointerLock(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas");
  if (!canvas) return;
  canvas.focus({ preventScroll: true });
  if (document.pointerLockElement !== canvas) void canvas.requestPointerLock().catch(() => undefined);
}

/** 역할별 긴급 행동과 마피아 원격 사보타지를 제공한다.
 * @returns 게임 조작 영역
 */
export function GameActions() {
  const room = useGameStore((state) => state.room);
  const id = useGameStore((state) => state.playerId);
  const role = useGameStore((state) => state.role);
  const blackout = useGameStore((state) => state.environment?.blackout ?? false);
  const aimedKillTargetId = useGameStore((state) => state.aimedKillTargetId);
  const [sabotageHeld, setSabotageHeld] = useState(false);

  useEffect(() => {
    let restoreAfterPointerUnlock = false;
    /** 이전 포인터 잠금 해제가 끝난 뒤, 대기 중인 게임 조작 복구를 수행한다. */
    const onPointerLockChange = () => {
      if (!restoreAfterPointerUnlock || document.pointerLockElement) return;
      restoreAfterPointerUnlock = false;
      restoreGamePointerLock();
    };
    /** 마피아가 Caps Lock을 누르는 동안 포인터 잠금을 풀고 시설 지도를 연다. */
    const onKeyDown = (event: KeyboardEvent) => { if (role === "MAFIA" && event.code === "CapsLock" && !event.repeat) { event.preventDefault(); restoreAfterPointerUnlock = false; document.exitPointerLock(); setSabotageHeld(true); } if (event.code === "Escape") { event.preventDefault(); setSabotageHeld(false); if (document.pointerLockElement) restoreAfterPointerUnlock = true; else restoreGamePointerLock(); } };
    /** Caps Lock을 놓으면 지도와 포인터를 원래 게임 조작으로 되돌린다. */
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === "CapsLock") { event.preventDefault(); setSabotageHeld(false); if (document.pointerLockElement) restoreAfterPointerUnlock = true; else restoreGamePointerLock(); } };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); document.removeEventListener("pointerlockchange", onPointerLockChange); };
  }, [role]);

  if (!room || !id) return null;
  const me = room.players.find((player) => player.id === id);
  const canAct = room.gameState === "PLAYING" && me?.lifeState === "ALIVE";
  const sabotage = (generatorId: GeneratorId) => { if (canAct) getActiveGameClient()?.environment("SABOTAGE", generatorId); };
  const aimedTarget = aimedKillTargetId ? room.players.find((player) => player.id === aimedKillTargetId) : undefined;
  return <><SabotageMap held={role === "MAFIA" && sabotageHeld} blackout={blackout} onSabotage={sabotage} /><KillCooldownIndicator /><RepairProgressIndicator /><aside className="fixed bottom-4 left-4 right-28 z-10 flex flex-wrap gap-2 rounded-xl bg-slate-950/90 p-3 text-sm text-white sm:left-auto sm:right-32 sm:w-[420px]"><span className="mr-auto self-center">역할: <b className={role === "MAFIA" ? "text-rose-300" : "text-cyan-300"}>{role === "MAFIA" ? "마피아" : "생존자"}</b> {blackout ? "· 정전" : "· 전력 정상"}</span>{canAct ? <><button type="button" onClick={() => getActiveGameClient()?.callMeeting()} className="rounded bg-amber-500 px-3 py-2 font-semibold text-slate-950">긴급 회의</button>{role === "MAFIA" ? <span className="self-center text-xs text-rose-200">{aimedTarget ? `${aimedTarget.displayName} 조준 중 · 좌클릭 처치` : "시민을 크로스헤어로 조준해 좌클릭 처치 · Caps 시설 지도"}</span> : <span className="self-center text-xs text-emerald-200">고장 난 발전기를 조준하고 E를 누르세요.</span>}</> : null}</aside></>;
}
