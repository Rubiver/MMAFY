import { Hud } from "./ui/Hud";
import { World } from "./game/World";
import { Lobby } from "./ui/Lobby";
import { useGameStore } from "./store/gameStore";
import { GameActions } from "./ui/GameActions";

/** 3D 월드와 화면 안내를 조합하는 최상위 화면이다.
 * @returns 기본 게임 화면
 */
export function App() {
  const gameState = useGameStore((state) => state.room?.gameState);
  if (gameState !== "PLAYING") return <Lobby />;
  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950">
      <World />
      <Hud />
      <GameActions />
      <div className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl text-white [text-shadow:0_1px_4px_#000]" aria-hidden="true">+</div>
    </main>
  );
}
