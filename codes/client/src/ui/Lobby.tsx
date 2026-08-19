import { useMemo, useState } from "react";
import { GameClient, setActiveGameClient } from "../network/gameClient";
import { useGameStore } from "../store/gameStore";

/** 입장, 준비, 시작을 제공하는 서버 권한형 대기실 화면이다. */
export function Lobby() {
  const [name, setName] = useState("참가자");
  const room = useGameStore((state) => state.room);
  const playerId = useGameStore((state) => state.playerId);
  const networkError = useGameStore((state) => state.networkError);
  const client = useMemo(() => new GameClient(useGameStore.getState().setRoom, useGameStore.getState().setNetworkError), []);
  setActiveGameClient(client);
  const me = room?.players.find((player) => player.id === playerId);
  const isHost = room?.hostId === playerId;

  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100"><section className="mx-auto max-w-2xl rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-2xl">
    <p className="text-sm font-semibold text-cyan-300">3D 사회 추리 게임</p><h1 className="mt-2 text-3xl font-bold">멀티플레이 대기실</h1>
    {!room ? <div className="mt-8 flex flex-col gap-3 sm:flex-row"><input aria-label="표시 이름" value={name} maxLength={16} onChange={(event) => setName(event.target.value)} className="rounded-xl bg-slate-800 px-4 py-3 outline-none ring-cyan-400 focus:ring" /><button onClick={() => client.connect(name)} className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">방 입장</button></div> : <>
      <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-800 p-4"><span>방 코드: <b>{room.roomId}</b></span><span>{room.players.filter((player) => player.connected).length} / {room.maxPlayers}명</span></div>
      <ul className="mt-4 space-y-2">{room.players.map((player) => <li key={player.id} className="flex justify-between rounded-lg bg-slate-800/70 px-4 py-3"><span>{player.displayName} {player.id === room.hostId ? "(방장)" : ""}</span><span className={player.ready ? "text-emerald-300" : "text-slate-400"}>{player.connected ? (player.ready ? "준비 완료" : "준비 중") : "재접속 대기"}</span></li>)}</ul>
      {room.gameState === "LOBBY" ? <div className="mt-6 flex gap-3"><button onClick={() => client.setReady(!me?.ready)} className="rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-950">{me?.ready ? "준비 취소" : "준비"}</button>{isHost ? <button onClick={() => client.startGame()} className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">게임 시작</button> : null}</div> : <p className="mt-6 rounded-xl bg-emerald-500/20 p-4 text-emerald-200">게임이 시작되었습니다. 화면을 클릭하고 WASD로 이동하세요.</p>}</>}
    {networkError ? <p role="alert" className="mt-4 text-rose-300">{networkError}</p> : null}
  </section></main>;
}
