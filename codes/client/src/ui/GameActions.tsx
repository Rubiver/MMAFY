import { useEffect, useState } from "react";
import { COOPERATIVE_TASK_DURATION_MS, type GeneratorId } from "@mafia/shared";
import { getActiveGameClient } from "../network/gameClient";
import { useGameStore } from "../store/gameStore";

/** Caps Lock을 누르는 동안 열리는 마피아 전용 시설 사보타지 지도다.
 * @param held Caps Lock 키 유지 여부
 * @param blackout 현재 정전 여부
 * @param onSabotage 발전기 고장 요청 처리
 * @returns 시설 선택 지도 또는 없음
 */
type SabotageTarget = GeneratorId | "communications";
function SabotageMap({ held, blackout, onSabotage }: { held: boolean; blackout: boolean; onSabotage: (target: SabotageTarget) => void }) {
  if (!held) return null;
  const points: { id: SabotageTarget; name: string; location: string; position: string }[] = [{ id: "generator-a", name: "발전기 A", location: "서쪽 전력실", position: "left-[15%] top-[62%]" }, { id: "generator-b", name: "발전기 B", location: "동쪽 전력실", position: "right-[12%] top-[28%]" }, { id: "communications", name: "통신 장치", location: "동쪽 통신실", position: "right-[26%] top-[62%]" }];
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

/** 서버가 확정한 협동 임무 참가 인원과 연속 진행 시간을 화면 중앙에 표시한다. */
function CooperativeTaskIndicator() {
  const playerId = useGameStore((state) => state.playerId);
  const participants = useGameStore((state) => state.environment?.cooperativeParticipantIds) ?? [];
  const progress = useGameStore((state) => state.environment?.cooperativeProgress ?? 0);
  if (!playerId || !participants.includes(playerId)) return null;
  const ready = participants.length >= 2;
  const seconds = Math.max(0, Math.ceil((1 - progress) * COOPERATIVE_TASK_DURATION_MS / 1000));
  return <div className="pointer-events-none fixed left-1/2 top-1/2 z-20 w-[min(21rem,calc(100vw-2rem))] -translate-x-1/2 translate-y-8 rounded-xl border border-teal-200/50 bg-slate-950/90 p-3 text-teal-50 shadow-2xl backdrop-blur-md" aria-label={`협동 임무 참가 ${participants.length}명`}><div className="flex items-center justify-between gap-3 text-xs font-bold"><span>{ready ? "교량 동기화 진행 중" : "동료 시민 대기 중"}</span><span>{participants.length} / 2명{ready ? ` · ${seconds}초` : ""}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full transition-[width] duration-200 ${ready ? "bg-teal-300" : "bg-amber-300"}`} style={{ width: `${ready ? progress * 100 : 8}%` }} /></div><p className="mt-2 text-[11px] text-slate-300">두 시민 모두 [E]를 유지해야 합니다. 이탈·사망·정전 시 처음부터 다시 시작합니다.</p></div>;
}

/** 시민이 회로 제어반에서 순서 퍼즐을 풀 수 있는 패널이다.
 * @returns 회로 퍼즐 패널 또는 없음
 */
function CircuitTaskPanel() {
  const open = useGameStore((state) => state.taskPanelOpen);
  const setOpen = useGameStore((state) => state.setTaskPanelOpen);
  const setMessage = useGameStore((state) => state.setInteractionMessage);
  const [sequence, setSequence] = useState<string[]>([]);
  const colors = [{ id: "AMBER", name: "호박", className: "bg-amber-400 text-amber-950" }, { id: "CYAN", name: "청록", className: "bg-cyan-400 text-cyan-950" }, { id: "VIOLET", name: "보라", className: "bg-violet-400 text-violet-950" }];
  if (!open) return null;
  const choose = (color: string) => { const next = [...sequence, color]; if (next.length < 3) { setSequence(next); return; } getActiveGameClient()?.environment("TASK", undefined, next); setSequence([]); setOpen(false); setMessage("회로 연결 결과를 서버에 확인합니다."); restoreGamePointerLock(); };
  return <section className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4" aria-label="회로 연결 퍼즐"><div className="w-full max-w-md rounded-3xl border border-cyan-200/40 bg-slate-900 p-5 shadow-2xl sm:p-7"><p className="text-xs font-bold tracking-[0.16em] text-cyan-300">공통 임무 · 회로 제어반</p><h2 className="mt-2 text-2xl font-bold text-white">빛의 순서대로 회로를 연결하세요</h2><p className="mt-2 text-sm leading-6 text-slate-300">위의 신호 순서는 <b className="text-amber-200">호박 → 청록 → 보라</b>입니다. 올바르게 연결하면 공통 임무가 25% 진행됩니다.</p><div className="mt-5 flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/80">{[0, 1, 2].map((index) => <span key={index} className="flex h-9 w-20 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-slate-300">{sequence[index] ? colors.find((color) => color.id === sequence[index])?.name : "?"}</span>)}</div><div className="mt-5 grid grid-cols-3 gap-3">{colors.map((color) => <button key={color.id} type="button" onClick={() => choose(color.id)} className={`min-h-16 rounded-2xl px-2 py-3 text-sm font-bold transition hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-white ${color.className}`}>{color.name}</button>)}</div><button type="button" onClick={() => { setSequence([]); setOpen(false); restoreGamePointerLock(); }} className="mt-4 w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200">취소</button></div></section>;
}

/** 시민이 방향 패턴을 순서대로 입력하는 보안 카드 인증 화면이다. */
function SecurityCardPanel() {
  const open = useGameStore((state) => state.securityCardPanelOpen);
  const setOpen = useGameStore((state) => state.setSecurityCardPanelOpen);
  const setMessage = useGameStore((state) => state.setInteractionMessage);
  const [pattern, setPattern] = useState<string[]>([]);
  const directions = [{ id: "LEFT", symbol: "←", name: "왼쪽" }, { id: "UP", symbol: "↑", name: "위" }, { id: "RIGHT", symbol: "→", name: "오른쪽" }, { id: "DOWN", symbol: "↓", name: "아래" }];
  if (!open) return null;
  const choose = (direction: string) => { const next = [...pattern, direction]; if (next.length < 4) { setPattern(next); return; } getActiveGameClient()?.environment("SECURITY_CARD_TASK", undefined, next); setPattern([]); setOpen(false); setMessage("보안 카드 인증 결과를 서버에 확인합니다."); restoreGamePointerLock(); };
  const close = () => { setPattern([]); setOpen(false); restoreGamePointerLock(); };
  return <section className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4" aria-label="보안 카드 인증"><div className="w-full max-w-lg rounded-3xl border border-sky-200/40 bg-slate-900 p-5 shadow-2xl shadow-sky-950/50 sm:p-7"><p className="text-xs font-bold tracking-[0.16em] text-sky-300">공통 임무 · 보안 카드</p><h2 className="mt-2 text-2xl font-bold text-white">표시된 방향으로 카드를 인증하세요</h2><p className="mt-2 text-sm leading-6 text-slate-300">인증 패턴은 <b className="text-sky-200">왼쪽 → 위 → 오른쪽 → 아래</b>입니다. 서버가 순서·거리·중복 완료를 확인합니다.</p><div className="mt-5 flex h-16 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/80">{[0, 1, 2, 3].map((index) => <span key={index} className="flex h-10 w-14 items-center justify-center rounded-xl bg-slate-800 text-xl font-bold text-sky-200">{directions.find((item) => item.id === pattern[index])?.symbol ?? "?"}</span>)}</div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{directions.map((direction) => <button key={direction.id} type="button" onClick={() => choose(direction.id)} className="min-h-20 rounded-2xl border border-sky-200/30 bg-sky-500/15 px-3 py-3 text-sky-50 transition hover:scale-[1.03] hover:bg-sky-500/25 focus:outline-none focus:ring-2 focus:ring-sky-200"><span className="block text-2xl" aria-hidden="true">{direction.symbol}</span><b className="mt-1 block text-sm">{direction.name}</b></button>)}</div><button type="button" onClick={close} className="mt-4 w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700">취소</button></div></section>;
}

/** 시민이 관제실에서만 열 수 있는 원격 참가자 관제 화면이다.
 * @returns CCTV 관제 화면 또는 없음
 */
function CctvPanel() {
  const open = useGameStore((state) => state.cctvOpen);
  const room = useGameStore((state) => state.room);
  const online = useGameStore((state) => state.environment?.cctvOnline ?? false);
  const setOpen = useGameStore((state) => state.setCctvOpen);
  const close = () => { getActiveGameClient()?.environment("CCTV_CLOSE"); setOpen(false); restoreGamePointerLock(); };
  useEffect(() => { if (open && !online) setOpen(false); }, [online, open, setOpen]);
  if (!open) return null;
  const alive = room?.players.filter((player) => player.lifeState === "ALIVE" && player.connected) ?? [];
  return <section className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6" aria-label="CCTV 관제 화면"><div className="w-full max-w-5xl rounded-3xl border border-cyan-200/35 bg-slate-950 p-4 shadow-2xl shadow-cyan-950/40 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold tracking-[0.18em] text-cyan-300">관제실 · 이동 잠금</p><h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">CCTV 실시간 관제</h2></div><button type="button" onClick={close} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700">닫기 · Esc</button></div><p className="mt-2 text-sm text-slate-300">각 신호는 서버가 공유한 생존자 위치입니다. 관제를 닫아야 다시 움직일 수 있습니다.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{alive.map((player, index) => <article key={player.id} className="relative min-h-32 overflow-hidden rounded-2xl border border-cyan-200/20 bg-[linear-gradient(135deg,#0d2839,#071018)] p-4"><div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(103,232,249,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,.16)_1px,transparent_1px)] [background-size:18px_18px]" /><div className="relative flex items-center justify-between text-[10px] font-bold tracking-wider text-cyan-200"><span>CAM-{String(index + 1).padStart(2, "0")}</span><span className="rounded bg-emerald-400/20 px-2 py-1 text-emerald-200">신호 정상</span></div><div className="relative mt-7"><b className="text-lg text-white">{player.displayName}</b><p className="mt-1 text-xs text-cyan-100/80">위치 X {Math.round(player.position.x)} · Z {Math.round(player.position.z)}</p></div></article>)}{alive.length === 0 ? <p className="text-sm text-slate-300">표시할 생존자 신호가 없습니다.</p> : null}</div></div></section>;
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
  const killTargetIds = useGameStore((state) => state.killTargetIds);
  const taskPanelOpen = useGameStore((state) => state.taskPanelOpen);
  const setTaskPanelOpen = useGameStore((state) => state.setTaskPanelOpen);
  const securityCardPanelOpen = useGameStore((state) => state.securityCardPanelOpen);
  const setSecurityCardPanelOpen = useGameStore((state) => state.setSecurityCardPanelOpen);
  const cctvOpen = useGameStore((state) => state.cctvOpen);
  const setCctvOpen = useGameStore((state) => state.setCctvOpen);
  const spectatorTargetId = useGameStore((state) => state.spectatorTargetId);
  const setSpectatorTarget = useGameStore((state) => state.setSpectatorTarget);
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
    const onKeyDown = (event: KeyboardEvent) => { if (role === "MAFIA" && event.code === "CapsLock" && !event.repeat) { event.preventDefault(); restoreAfterPointerUnlock = false; document.exitPointerLock(); setSabotageHeld(true); } if (event.code === "Escape") { event.preventDefault(); setSabotageHeld(false); if (taskPanelOpen) setTaskPanelOpen(false); if (securityCardPanelOpen) setSecurityCardPanelOpen(false); if (cctvOpen) { getActiveGameClient()?.environment("CCTV_CLOSE"); setCctvOpen(false); } if (document.pointerLockElement) restoreAfterPointerUnlock = true; else restoreGamePointerLock(); } };
    /** Caps Lock을 놓으면 지도와 포인터를 원래 게임 조작으로 되돌린다. */
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === "CapsLock") { event.preventDefault(); setSabotageHeld(false); if (document.pointerLockElement) restoreAfterPointerUnlock = true; else restoreGamePointerLock(); } };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); document.removeEventListener("pointerlockchange", onPointerLockChange); };
  }, [cctvOpen, role, securityCardPanelOpen, setCctvOpen, setSecurityCardPanelOpen, setTaskPanelOpen, taskPanelOpen]);

  if (!room || !id) return null;
  const me = room.players.find((player) => player.id === id);
  const canAct = room.gameState === "PLAYING" && me?.lifeState === "ALIVE";
  const spectatorTargets = room.players.filter((player) => player.id !== id && player.connected && player.lifeState === "ALIVE");
  const sabotage = (target: SabotageTarget) => { if (!canAct) return; if (target === "communications") getActiveGameClient()?.environment("COMM_SABOTAGE"); else getActiveGameClient()?.environment("SABOTAGE", target); };
  const aimedTarget = aimedKillTargetId ? room.players.find((player) => player.id === aimedKillTargetId) : undefined;
  const killTargets = killTargetIds.map((targetId) => room.players.find((player) => player.id === targetId)).filter((player): player is NonNullable<typeof player> => Boolean(player));
  return <><SabotageMap held={role === "MAFIA" && sabotageHeld} blackout={blackout} onSabotage={sabotage} /><CircuitTaskPanel /><SecurityCardPanel /><CctvPanel /><KillCooldownIndicator /><RepairProgressIndicator /><CooperativeTaskIndicator /><aside className="fixed bottom-4 left-4 right-28 z-10 flex flex-wrap gap-2 rounded-xl bg-slate-950/90 p-3 text-sm text-white sm:left-auto sm:right-32 sm:w-[420px]"><span className="mr-auto self-center">역할: <b className={role === "MAFIA" ? "text-rose-300" : "text-cyan-300"}>{role === "MAFIA" ? "마피아" : "생존자"}</b> {blackout ? "· 정전" : "· 전력 정상"}</span>{canAct ? <>{role === "MAFIA" ? <div className="flex w-full flex-wrap items-center gap-2 text-xs text-rose-100">{killTargets.length ? <>{killTargets.map((target) => <button key={target.id} type="button" onClick={() => getActiveGameClient()?.kill(target.id)} className={`rounded px-2 py-1 font-semibold ${target.id === aimedTarget?.id ? "bg-rose-500 text-white" : "bg-rose-950/70 text-rose-100"}`}>처치: {target.displayName}</button>)}<span>{aimedTarget ? `${aimedTarget.displayName} 선택 · [Q] 대상 전환 · [F]/좌클릭 처치` : "[Q]로 처치 대상을 선택하세요."}</span></> : <span>처치 거리 안에 시민이 없습니다 · Caps 시설 지도</span>}</div> : <span className="self-center text-xs text-emerald-200">회로·보안 카드·교량 동기화·CCTV·긴급 회의 장치 가까이에서 E를 누르세요.</span>}</> : null}{room.gameState === "PLAYING" && me?.lifeState !== "ALIVE" ? <div className="w-full border-t border-violet-200/20 pt-2 text-xs text-violet-100"><p className="mb-2 font-semibold">관전 대상 선택</p><div className="flex flex-wrap gap-2">{spectatorTargets.map((player) => <button key={player.id} type="button" onClick={() => setSpectatorTarget(player.id)} className={`rounded px-2 py-1 font-semibold ${spectatorTargetId === player.id ? "bg-violet-400 text-slate-950" : "bg-violet-950/70 hover:bg-violet-900"}`}>{player.displayName}</button>)}</div></div> : null}</aside></>;
}
