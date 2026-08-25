import { lazy, Suspense } from "react";
import { Hud } from "./ui/Hud";
import { Lobby } from "./ui/Lobby";
import { useGameStore } from "./store/gameStore";
import { GameActions } from "./ui/GameActions";
import { Meeting } from "./ui/Meeting";

const World = lazy(() => import("./game/World").then((module) => ({ default: module.World })));

/** 3D 월드와 화면 안내를 조합하는 최상위 화면이다.
 * @returns 기본 게임 화면
 */
export function App() {
  const gameState = useGameStore((state) => state.room?.gameState);
  const meetingOpen = gameState === "MEETING" || gameState === "VOTING";
  if (gameState !== "PLAYING" && !meetingOpen) return <Lobby />;
  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm font-semibold text-sky-100">3D 시험 구역을 준비하고 있습니다…</div>}><World /></Suspense>
      <Hud />
      <GameActions />
      <div className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl text-white [text-shadow:0_1px_4px_#000]" aria-hidden="true">+</div>
      {meetingOpen ? <Meeting /> : null}
    </main>
  );
}
