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
  mafiaIds: string[];
  environment?: EnvironmentState;
  killCooldownUntil?: number;
  aimedKillTargetId?: string;
  killTargetIds: string[];
  nearbyBodyId?: string;
  spectatorTargetId?: string;
  repairProgress: number;
  taskPanelOpen: boolean;
  securityCardPanelOpen: boolean;
  cctvOpen: boolean;
  setPlayerPosition: (position: Vector3Data) => void;
  setNearbyDevice: (device?: InteractableState) => void;
  setInteractionMessage: (message?: string) => void;
  setRoom: (room: RoomSnapshot, playerId: string) => void;
  setNetworkError: (message?: string) => void;
  setRole: (role: RoleTeam, mafiaIds: string[]) => void;
  setEnvironment: (environment: EnvironmentState) => void;
  setKillCooldown: (remainingMs: number) => void;
  setAimedKillTarget: (playerId?: string) => void;
  setKillTargetIds: (playerIds: string[]) => void;
  setNearbyBody: (bodyId?: string) => void;
  setSpectatorTarget: (playerId?: string) => void;
  setRepairProgress: (progress: number) => void;
  setTaskPanelOpen: (open: boolean) => void;
  setSecurityCardPanelOpen: (open: boolean) => void;
  setCctvOpen: (open: boolean) => void;
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
  mafiaIds: [],
  killTargetIds: [],
  repairProgress: 0,
  taskPanelOpen: false,
  securityCardPanelOpen: false,
  cctvOpen: false,
  setRole: (role, mafiaIds) => set({ role, mafiaIds }),
  setEnvironment: (environment) => set({ environment }),
  setKillCooldown: (remainingMs) => set({ killCooldownUntil: Date.now() + remainingMs }),
  setAimedKillTarget: (aimedKillTargetId) => set({ aimedKillTargetId }),
  setKillTargetIds: (killTargetIds) => set({ killTargetIds }),
  setNearbyBody: (nearbyBodyId) => set({ nearbyBodyId }),
  setSpectatorTarget: (spectatorTargetId) => set({ spectatorTargetId }),
  setRepairProgress: (repairProgress) => set({ repairProgress: Math.min(1, Math.max(0, repairProgress)) }),
  setTaskPanelOpen: (taskPanelOpen) => set({ taskPanelOpen }),
  setSecurityCardPanelOpen: (securityCardPanelOpen) => set({ securityCardPanelOpen }),
  setCctvOpen: (cctvOpen) => set({ cctvOpen }),
}));

declare global {
  interface Window { __MAFIA_QA__?: { openSecurityCard: () => void } }
}

/** 개발 화면 검증에서 서버 결과를 바꾸지 않고 보안 카드 화면만 여는 제한된 도우미다. */
if (import.meta.env.DEV) window.__MAFIA_QA__ = { openSecurityCard: () => { if (document.pointerLockElement) document.exitPointerLock(); useGameStore.getState().setSecurityCardPanelOpen(true); } };
