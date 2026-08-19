import { useGameStore } from "../store/gameStore";

/** 현재 조작 방법과 가까운 장치 안내를 화면 위에 표시한다.
 * @returns 게임 머리 위 화면 구성
 */
export function Hud() {
  const nearbyDevice = useGameStore((state) => state.nearbyDevice);
  const interactionMessage = useGameStore((state) => state.interactionMessage);
  const playerPosition = useGameStore((state) => state.playerPosition);
  return (
    <aside className="pointer-events-none fixed left-3 top-3 w-[calc(100vw-24px)] rounded-xl border border-sky-200/25 bg-slate-950/80 p-4 text-slate-200 shadow-2xl shadow-black/20 backdrop-blur-md sm:left-6 sm:top-6 sm:w-[360px] sm:p-5" aria-label="게임 안내">
      <p className="text-xs font-bold uppercase tracking-widest text-sky-300">시험 구역 · 단일 이용자</p>
      <h1 className="mb-2 mt-1 text-2xl font-bold text-white">중앙홀</h1>
      <p className="text-sm leading-6 text-slate-300">WASD 이동 · Shift 달리기 · 화면 클릭 후 마우스 회전</p>
      <p className="mt-1 text-sm tabular-nums text-slate-400">위치 {playerPosition.x.toFixed(1)}, {playerPosition.z.toFixed(1)}</p>
      {nearbyDevice ? <p className="mt-3 rounded-lg bg-amber-300/15 px-3 py-2 text-sm text-amber-100">[E] {nearbyDevice.name} 살펴보기</p> : <p className="mt-3 rounded-lg bg-slate-300/10 px-3 py-2 text-sm text-slate-400">가까운 장치를 탐색하세요</p>}
      {interactionMessage ? <p className="mt-2 text-sm text-emerald-300">{interactionMessage}</p> : null}
    </aside>
  );
}
