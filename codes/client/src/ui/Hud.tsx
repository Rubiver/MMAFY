import { useGameStore } from "../store/gameStore";

/** 현재 조작 방법과 가까운 장치 안내를 화면 위에 표시한다.
 * @returns 게임 머리 위 화면 구성
 */
export function Hud() {
  const nearbyDevice = useGameStore((state) => state.nearbyDevice);
  const interactionMessage = useGameStore((state) => state.interactionMessage);
  const playerPosition = useGameStore((state) => state.playerPosition);
  const blackout = useGameStore((state) => state.environment?.blackout ?? false);
  const role = useGameStore((state) => state.role);
  const taskProgress = useGameStore((state) => state.environment?.taskProgress ?? 0);
  const alarmActive = useGameStore((state) => state.environment?.alarmActive ?? false);
  const barricades = useGameStore((state) => state.environment?.barricades) ?? [];
  const cargoCarriers = useGameStore((state) => state.environment?.cargoCarrierIds) ?? [];
  const cargoCompleted = useGameStore((state) => state.environment?.cargoCompletedIds) ?? [];
  const securityCardCompleted = useGameStore((state) => state.environment?.securityCardCompletedIds) ?? [];
  const dataSortCompleted = useGameStore((state) => state.environment?.dataSortCompletedIds) ?? [];
  const coolantCompleted = useGameStore((state) => state.environment?.coolantCompletedIds) ?? [];
  const cooperativeCompleted = useGameStore((state) => state.environment?.cooperativeCompleted ?? false);
  const playerId = useGameStore((state) => state.playerId);
  const lifeState = useGameStore((state) => state.room?.players.find((player) => player.id === state.playerId)?.lifeState);
  return (
    <>
    <aside className="pointer-events-none fixed left-3 top-3 w-[calc(100vw-24px)] rounded-xl border border-sky-200/25 bg-slate-950/80 p-4 text-slate-200 shadow-2xl shadow-black/20 backdrop-blur-md sm:left-6 sm:top-6 sm:w-[360px] sm:p-5" aria-label="게임 안내">
      <p className="text-xs font-bold uppercase tracking-widest text-sky-300">시험 구역 · 최대 25명</p>
      <h1 className="mb-2 mt-1 text-2xl font-bold text-white">중앙 복도</h1>
      <p className="text-sm leading-6 text-slate-300">WASD 이동 · Shift 달리기 · 화면 클릭 후 마우스 회전</p>
      <p className="mt-1 text-sm tabular-nums text-slate-400">위치 {playerPosition.x.toFixed(1)}, {playerPosition.z.toFixed(1)}</p>
      {lifeState !== "ALIVE" ? <p className="mt-3 rounded-lg border border-violet-200/40 bg-violet-950/70 px-3 py-2 text-sm font-semibold text-violet-100">사망 · 관전 모드입니다. 살아 있는 참가자를 따라봅니다.</p> : null}
      {role === "SURVIVOR" ? <div className="mt-3 rounded-lg border border-cyan-200/20 bg-cyan-300/10 px-3 py-2"><div className="flex justify-between text-xs font-bold text-cyan-100"><span>공통 임무</span><span>{taskProgress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/80"><div className="h-full rounded-full bg-cyan-300 transition-[width]" style={{ width: `${taskProgress}%` }} /></div></div> : null}
      {role === "SURVIVOR" ? <p className="mt-2 rounded-lg border border-orange-200/25 bg-orange-300/10 px-3 py-2 text-sm text-orange-100">물품 운송 · {cargoCompleted.includes(playerId ?? "") ? "납품 완료" : cargoCarriers.includes(playerId ?? "") ? "물품 보유 · 동쪽 통신실 납품대로 이동" : "서쪽 숲 보급 상자에서 물품 획득"}</p> : null}
      {role === "SURVIVOR" ? <p className="mt-2 rounded-lg border border-sky-200/25 bg-sky-300/10 px-3 py-2 text-sm text-sky-100">보안 카드 · {securityCardCompleted.includes(playerId ?? "") ? "인증 완료" : "중앙 복도 단말에서 방향 패턴 인증"}</p> : null}
      {role === "SURVIVOR" ? <p className="mt-2 rounded-lg border border-fuchsia-200/25 bg-fuchsia-300/10 px-3 py-2 text-sm text-fuchsia-100">자료 정렬 · {dataSortCompleted.includes(playerId ?? "") ? "정렬 완료" : "서쪽 작업대에서 번호순 정렬"}</p> : null}
      {role === "SURVIVOR" ? <p className="mt-2 rounded-lg border border-teal-200/25 bg-teal-300/10 px-3 py-2 text-sm text-teal-100">냉각수 배합 · {coolantCompleted.includes(playerId ?? "") ? "배합 완료" : "동쪽 설비에서 목표 비율 조정"}</p> : null}
      {role === "SURVIVOR" ? <p className="mt-2 rounded-lg border border-teal-200/25 bg-teal-300/10 px-3 py-2 text-sm text-teal-100">교량 동기화 · {cooperativeCompleted ? "협동 완료" : "북쪽 중앙 교량에서 시민 2명이 [E]를 5초 유지"}</p> : null}
      {role === "SURVIVOR" ? <p className="mt-2 rounded-lg border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">바리케이드 · {barricades.some((barricade) => barricade.ownerId === playerId) ? "이번 판 사용함" : "[B]로 앞쪽에 1개 설치 가능"}</p> : null}
      {alarmActive ? <p className="mt-2 rounded-lg border border-rose-200/50 bg-rose-950/80 px-3 py-2 text-sm font-bold text-rose-100">경보 작동 · 바리케이드가 설치되어 있습니다.</p> : null}
      {blackout && role === "SURVIVOR" ? <p className="mt-3 rounded-lg border border-rose-300/40 bg-rose-950/70 px-3 py-2 text-sm font-semibold text-rose-100">정전 발생 · 시야가 4.5미터로 제한됩니다. 발전기 A를 복구하세요.</p> : null}
      {nearbyDevice ? <p className="mt-3 rounded-lg bg-amber-300/15 px-3 py-2 text-sm text-amber-100">[E] {nearbyDevice.name} 살펴보기</p> : <p className="mt-3 rounded-lg bg-slate-300/10 px-3 py-2 text-sm text-slate-400">가까운 장치를 탐색하세요</p>}
      {interactionMessage ? <p className="mt-2 text-sm text-emerald-300">{interactionMessage}</p> : null}
    </aside>
    {cargoCarriers.includes(playerId ?? "") ? <div className="pointer-events-none fixed left-1/2 top-1/2 z-10 -translate-x-1/2 translate-y-10" aria-label="운반 중인 물품"><div className="h-9 w-11 rounded-md border-2 border-amber-200 bg-amber-700/90 shadow-lg shadow-black/40"><span className="flex h-full items-center justify-center text-[10px] font-bold text-amber-50">물품</span></div></div> : null}
    </>
  );
}
