import { create } from "zustand";
import type { EnvironmentState, InteractableState, RoleTeam, RoomSnapshot, Vector3Data } from "@mafia/shared";

type GameStore = {
  playerPosition: Vector3Data;
  nearbyDevice?: InteractableState;
  interactionMessage?: string;
  room?: RoomSnapshot;
  playerId?: string;
  networkError?: string;
  role?: RoleTeam;
  environment?: EnvironmentState;
  setPlayerPosition: (position: Vector3Data) => void;
  setNearbyDevice: (device?: InteractableState) => void;
  setInteractionMessage: (message?: string) => void;
  setRoom: (room: RoomSnapshot, playerId: string) => void;
  setNetworkError: (message?: string) => void;
  setRole: (role: RoleTeam) => void;
  setEnvironment: (environment: EnvironmentState) => void;
};

/** 화면 전용 플레이어 위치와 상호작용 안내 상태를 보관한다. */
export const useGameStore = create<GameStore>((set) => ({
  playerPosition: { x: 0, y: 0, z: 4 },
  nearbyDevice: undefined,
  interactionMessage: undefined,
  setPlayerPosition: (playerPosition) => set({ playerPosition }),
  setNearbyDevice: (nearbyDevice) => set({ nearbyDevice }),
  setInteractionMessage: (interactionMessage) => set({ interactionMessage }),
  setRoom: (room, playerId) => set({ room, playerId, networkError: undefined }),
  setNetworkError: (networkError) => set({ networkError }),
  setRole: (role) => set({ role }),
  setEnvironment: (environment) => set({ environment }),
}));
