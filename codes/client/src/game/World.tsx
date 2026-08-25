import { useEffect, useRef } from "react";
import { Billboard, Outlines, PointerLockControls, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { BARRICADE_COLLIDER_SIZE, CARGO_DELIVERY_POSITION, CARGO_PICKUP_POSITION, CCTV_CONSOLE_POSITION, CIRCUIT_PANEL_POSITION, COMMUNICATIONS_CONSOLE_POSITION, EMERGENCY_BELL_POSITION, GENERATOR_POSITIONS, KILL_RANGE, REPAIR_HOLD_DURATION_MS, SECURITY_CARD_POSITION, SECURITY_SHUTTER_POSITION, SURVIVOR_BLACKOUT_VIEW_DISTANCE, TREE_POSITIONS, VENT_ENTRANCE_POSITION, VENT_EXIT_POSITION, WORLD_COLLIDERS, WORLD_DEPTH, WORLD_WIDTH, type GeneratorId, type InteractableState, type Vector3Data } from "@mafia/shared";
import { getActiveGameClient } from "../network/gameClient";
import { useGameStore } from "../store/gameStore";
import { GAME_CONFIG } from "./config";
import { readMovementInput } from "./input";
import { findCrosshairInteractable, findCrosshairKillTarget, findNearbyInteractable, findNearbyKillTargets, findPrimaryAction } from "./interactions";
import { facingYaw, movementSpeed, movementVector } from "./movement";
import { isWalkablePosition, resolveLocalMovement } from "./localMovement";

const devices: InteractableState[] = [
  { id: "generator-a", name: "발전기 A", type: "GENERATOR", position: GENERATOR_POSITIONS["generator-a"], interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "generator-b", name: "발전기 B", type: "GENERATOR", position: GENERATOR_POSITIONS["generator-b"], interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "maintenance-ladder", name: "정비 사다리", type: "LADDER", position: { x: 72, y: 0, z: -36 }, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "forest-vent", name: "숲 환풍구", type: "VENT", position: VENT_ENTRANCE_POSITION, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "industry-vent", name: "산업 지대 환풍구", type: "VENT", position: VENT_EXIT_POSITION, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "emergency-bell", name: "긴급 회의 종", type: "BELL", position: EMERGENCY_BELL_POSITION, interactionRange: 2.4, currentState: "READY" },
  { id: "circuit-panel", name: "회로 제어반", type: "TASK_PANEL", position: CIRCUIT_PANEL_POSITION, interactionRange: 2.4, currentState: "READY" },
  { id: "security-card", name: "보안 카드 단말", type: "SECURITY_CARD", position: SECURITY_CARD_POSITION, interactionRange: 2.4, currentState: "READY" },
  { id: "cargo-pickup", name: "서쪽 숲 보급 상자", type: "CARGO_PICKUP", position: CARGO_PICKUP_POSITION, interactionRange: 2.4, currentState: "READY" },
  { id: "cargo-delivery", name: "통신실 납품대", type: "CARGO_DELIVERY", position: CARGO_DELIVERY_POSITION, interactionRange: 2.4, currentState: "READY" },
  { id: "security-shutter", name: "보안 셔터", type: "DOOR", position: SECURITY_SHUTTER_POSITION, interactionRange: 2.4, currentState: "READY" },
  { id: "cctv-console", name: "CCTV 관제대", type: "CCTV", position: CCTV_CONSOLE_POSITION, interactionRange: 2.4, currentState: "READY" },
  { id: "communications-console", name: "통신 복구 장치", type: "COMMUNICATIONS", position: COMMUNICATIONS_CONSOLE_POSITION, interactionRange: 2.4, currentState: "READY" },
];

let lastPrimaryActionAt = 0;
/** 게임 캔버스의 기본 클릭으로 가까운 시체 신고 또는 마피아 처치를 요청한다. */
function requestPrimaryAction(): void {
  const now = performance.now();
  if (now - lastPrimaryActionAt < 150) return;
  lastPrimaryActionAt = now;
  const state = useGameStore.getState();
  const action = findPrimaryAction(state.nearbyBodyId, state.role, state.aimedKillTargetId, state.killTargetIds);
  if (action?.type === "REPORT") getActiveGameClient()?.report(action.bodyId);
  else if (action?.type === "KILL") getActiveGameClient()?.kill(action.targetId);
}

/** 바닥이나 벽에 쓸 단순한 충돌 상자를 만든다.
 * @param position 상자 중심 위치
 * @param size 상자의 가로, 세로, 깊이
 * @param color 화면 표시 색
 * @returns 맵 장애물 메시
 */
function Block({ position, size, color = "#263647" }: { position: [number, number, number]; size: [number, number, number]; color?: string }) {
  return <RigidBody type="fixed" colliders={false}><CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} /><mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.8} /></mesh></RigidBody>;
}

/** 서버가 승인한 바리케이드를 시각·물리 충돌과 함께 표시한다. */
function Barricades() {
  const barricades = useGameStore((state) => state.environment?.barricades) ?? [];
  return <>{barricades.map((barricade) => <group key={barricade.id} position={[barricade.position.x, 0, barricade.position.z]}><Block position={[0, BARRICADE_COLLIDER_SIZE.y / 2, 0]} size={[BARRICADE_COLLIDER_SIZE.x, BARRICADE_COLLIDER_SIZE.y, BARRICADE_COLLIDER_SIZE.z]} color="#d97706" /><Text position={[0, 1.95, 0]} fontSize={0.2} color="#fde68a" anchorX="center">경보 바리케이드</Text></group>)}</>;
}

/** 맵 장치와 장치별 조명을 표시한다.
 * @param device 표시할 장치 상태
 * @returns 장치 메시와 조명
 */
function Device({ device }: { device: InteractableState }) {
  const colors = { GENERATOR: "#f4b942", DOOR: "#4ca7e8", LADDER: "#81c784", VENT: "#a78bfa", BELL: "#facc15", TASK_PANEL: "#22d3ee", SECURITY_CARD: "#38bdf8", CCTV: "#67e8f9", COMMUNICATIONS: "#f472b6", CARGO_PICKUP: "#fb923c", CARGO_DELIVERY: "#34d399" };
  const nearbyDeviceId = useGameStore((state) => state.nearbyDevice?.id);
  const role = useGameStore((state) => state.role);
  const blackout = useGameStore((state) => state.environment?.blackout ?? false);
  const doorState = useGameStore((state) => state.environment?.doorState ?? "OPEN");
  const cctvOnline = useGameStore((state) => state.environment?.cctvOnline ?? false);
  const communicationsOnline = useGameStore((state) => state.environment?.communicationsOnline ?? true);
  const cargoCarriers = useGameStore((state) => state.environment?.cargoCarrierIds) ?? [];
  const cargoCompleted = useGameStore((state) => state.environment?.cargoCompletedIds) ?? [];
  const playerId = useGameStore((state) => state.playerId);
  const usable = nearbyDeviceId === device.id && (device.type === "BELL" || (device.type === "TASK_PANEL" || device.type === "SECURITY_CARD") && role === "SURVIVOR" || device.type === "CARGO_PICKUP" && role === "SURVIVOR" && !cargoCarriers.includes(playerId ?? "") && !cargoCompleted.includes(playerId ?? "") || device.type === "CARGO_DELIVERY" && role === "SURVIVOR" && cargoCarriers.includes(playerId ?? "") || device.type === "CCTV" && role === "SURVIVOR" && cctvOnline || device.type === "COMMUNICATIONS" && role === "SURVIVOR" && !communicationsOnline || device.type === "DOOR" && (role === "MAFIA" && doorState === "CLOSED" || role === "SURVIVOR" && doorState !== "LOCKED") || device.type === "VENT" && role === "MAFIA" || device.type === "GENERATOR" && role === "SURVIVOR" && blackout);
  const highlightSize: [number, number, number] = device.type === "BELL" ? [1.5, 2.3, 1.5] : device.type === "TASK_PANEL" ? [1.4, 2.1, 0.8] : [1.5, 2, 1.3];
  return <group position={[device.position.x, 0, device.position.z]}>{device.type === "LADDER" ? <Block position={[0, 1.4, 0]} size={[0.45, 2.8, 0.2]} color={colors.LADDER} /> : null}{device.type === "GENERATOR" ? <Block position={[0, 0.65, 0]} size={[1.1, 1.3, 0.8]} color={colors.GENERATOR} /> : null}{device.type === "DOOR" && doorState !== "OPEN" ? <Block position={[0, 1.5, 0]} size={[0.5, 3, 3.2]} color={doorState === "LOCKED" ? "#ef4444" : colors.DOOR} /> : null}{device.type === "VENT" ? <group position={[0, 0.12, 0]}><mesh><cylinderGeometry args={[1.05, 1.05, 0.22, 24]} /><meshStandardMaterial color={colors.VENT} metalness={0.7} roughness={0.28} /></mesh></group> : null}{device.type === "BELL" ? <group position={[0, 1.05, 0]}><mesh castShadow><sphereGeometry args={[0.55, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={colors.BELL} /></mesh><Text position={[0, 1.05, 0]} fontSize={0.24} color="#fff7cc" anchorX="center">긴급 회의 종</Text></group> : null}{device.type === "TASK_PANEL" ? <group position={[0, 1, 0]}><mesh castShadow><boxGeometry args={[1.1, 1.7, 0.32]} /><meshStandardMaterial color="#164e63" /></mesh><Text position={[0, 1.25, 0]} fontSize={0.22} color="#cffafe" anchorX="center">회로 제어반</Text></group> : null}{device.type === "SECURITY_CARD" ? <group position={[0, 0.9, 0]}><mesh castShadow><boxGeometry args={[1.25, 1.45, 0.42]} /><meshStandardMaterial color="#0c4a6e" metalness={0.35} /></mesh><mesh position={[0, 0.15, -0.23]}><planeGeometry args={[0.86, 0.52]} /><meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.8} /></mesh><Text position={[0, 1.18, 0]} fontSize={0.21} color="#e0f2fe" anchorX="center">보안 카드</Text></group> : null}{device.type === "CARGO_PICKUP" ? <group position={[0, 0.55, 0]}><mesh castShadow><boxGeometry args={[1.4, 1.1, 1]} /><meshStandardMaterial color="#9a5b25" /></mesh><Text position={[0, 1.35, 0]} fontSize={0.21} color="#ffedd5" anchorX="center">보급 상자</Text></group> : null}{device.type === "CARGO_DELIVERY" ? <group position={[0, 0.7, 0]}><mesh castShadow><boxGeometry args={[1.6, 1.4, 0.6]} /><meshStandardMaterial color="#166534" /></mesh><Text position={[0, 1.55, 0]} fontSize={0.21} color="#d1fae5" anchorX="center">통신실 납품대</Text></group> : null}{device.type === "CCTV" ? <group position={[0, 1.05, 0]}><mesh castShadow><boxGeometry args={[1.5, 1.5, 0.45]} /><meshStandardMaterial color="#152b40" metalness={0.45} /></mesh><mesh position={[0, 0.08, -0.24]}><planeGeometry args={[1.16, 0.76]} /><meshStandardMaterial color={cctvOnline ? "#155e75" : "#172033"} emissive={cctvOnline ? "#0e7490" : "#000000"} emissiveIntensity={cctvOnline ? 0.8 : 0} /></mesh><Text position={[0, 1.35, 0]} fontSize={0.21} color="#cffafe" anchorX="center">CCTV 관제대</Text></group> : null}{usable ? <lineSegments position={[0, highlightSize[1] / 2, 0]} renderOrder={10}><edgesGeometry args={[new THREE.BoxGeometry(...highlightSize)]} /><lineBasicMaterial color="#fde047" depthTest={false} /></lineSegments> : null}<pointLight color={usable ? "#fde047" : colors[device.type]} intensity={usable ? 4 : 2} distance={usable ? 7 : 5} position={[0, 1.8, 0]} /></group>;
}

/** 숲 지역의 나무 한 그루를 간단한 줄기와 수관으로 표시한다. */
function Tree({ position }: { position: Vector3Data }) {
  return <group position={[position.x, 0, position.z]}><mesh castShadow position={[0, 1.5, 0]}><cylinderGeometry args={[0.42, 0.58, 3, 8]} /><meshStandardMaterial color="#5d3a22" roughness={1} /></mesh><mesh castShadow position={[0, 4.1, 0]}><coneGeometry args={[2.4, 4.8, 10]} /><meshStandardMaterial color="#245a3d" roughness={0.9} /></mesh><mesh castShadow position={[0, 5.7, 0]}><coneGeometry args={[1.8, 3.8, 10]} /><meshStandardMaterial color="#31734b" roughness={0.9} /></mesh></group>;
}

/** 강을 막는 수면과 두 개의 횡단 교량, 숲의 수목을 그린다. */
function OutdoorLandmarks() {
  const bridgePositions = [-27.5, 27.5];
  return <><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow><planeGeometry args={[16, WORLD_DEPTH]} /><meshStandardMaterial color="#1b6c92" roughness={0.38} metalness={0.16} /></mesh>{bridgePositions.map((z) => <group key={z} position={[0, 0.28, z]}><mesh castShadow receiveShadow><boxGeometry args={[22, 0.42, 9]} /><meshStandardMaterial color="#72512f" roughness={0.84} /></mesh><mesh position={[0, 1.05, -3.9]}><boxGeometry args={[22, 0.12, 0.14]} /><meshStandardMaterial color="#d8b679" metalness={0.45} /></mesh><mesh position={[0, 1.05, 3.9]}><boxGeometry args={[22, 0.12, 0.14]} /><meshStandardMaterial color="#d8b679" metalness={0.45} /></mesh></group>)}{TREE_POSITIONS.map((position, index) => <Tree key={index} position={position} />)}<Text position={[-68, 6, 62]} fontSize={3} color="#c4f1d5" anchorX="center">서쪽 숲</Text><Text position={[56, 6, -62]} fontSize={3} color="#dbeafe" anchorX="center">동쪽 산업 지대</Text></>;
}

/** 정전 중 시민에게만 벽 너머에서도 보이는 발전기 외곽선을 표시한다.
 * @returns 발전기 외곽선 또는 없음
 */
function GeneratorBlackoutOutline() {
  const blackout = useGameStore((state) => state.environment?.blackout ?? false);
  const generators = useGameStore((state) => state.environment?.generators);
  const role = useGameStore((state) => state.role);
  if (!blackout || role !== "SURVIVOR") return null;
  return <>{devices.filter((device) => device.type === "GENERATOR" && !generators?.[device.id as GeneratorId]).map((device) => <lineSegments key={device.id} position={[device.position.x, 0.65, device.position.z]} renderOrder={10} frustumCulled={false}><edgesGeometry args={[new THREE.BoxGeometry(1.2, 1.4, 0.9)]} /><lineBasicMaterial color="#facc15" transparent opacity={0.9} depthTest={false} depthWrite={false} fog={false} /></lineSegments>)}</>;
}

/** 키보드와 마우스 입력으로 물리 플레이어를 이동하고 카메라를 따라가게 한다.
 * @returns 플레이어 물리 본체
 */
function PlayerController() {
  const player = useRef<THREE.Group>(null);
  const pressed = useRef(new Set<string>());
  const setPlayerPosition = useGameStore((state) => state.setPlayerPosition);
  const setNearbyDevice = useGameStore((state) => state.setNearbyDevice);
  const setInteractionMessage = useGameStore((state) => state.setInteractionMessage);
  const setAimedKillTarget = useGameStore((state) => state.setAimedKillTarget);
  const setKillTargetIds = useGameStore((state) => state.setKillTargetIds);
  const setNearbyBody = useGameStore((state) => state.setNearbyBody);
  const spectatorTargetId = useGameStore((state) => state.spectatorTargetId);
  const setSpectatorTarget = useGameStore((state) => state.setSpectatorTarget);
  const setRepairProgress = useGameStore((state) => state.setRepairProgress);
  const setTaskPanelOpen = useGameStore((state) => state.setTaskPanelOpen);
  const setSecurityCardPanelOpen = useGameStore((state) => state.setSecurityCardPanelOpen);
  const setCctvOpen = useGameStore((state) => state.setCctvOpen);
  const lifeState = useGameStore((state) => state.room?.players.find((item) => item.id === state.playerId)?.lifeState);
  const { camera, gl } = useThree();
  const lastSendAt = useRef(0);
  const sequence = useRef(0);
  const repairTimer = useRef<number | undefined>(undefined);
  const repairProgressTimer = useRef<number | undefined>(undefined);
  const repairActive = useRef(false);
  const repairStartedAt = useRef(0);
  const aimedTargetId = useRef<string | undefined>(undefined);
  const manuallySelectedTargetId = useRef<string | undefined>(undefined);
  const nearbyKillTargetIds = useRef<string[]>([]);
  const spawnPosition = useGameStore((state) => state.room?.players.find((player) => player.id === state.playerId)?.position);
  const localPosition = useRef<Vector3Data>(spawnPosition ?? { x: 0, y: GAME_CONFIG.playerHeight, z: 4 });

  useEffect(() => {
    /** 키를 이동 입력 집합에 추가하고, 조준한 발전기의 복구를 시작한다. */
    const onKeyDown = (event: KeyboardEvent) => {
      pressed.current.add(event.code);
      const state = useGameStore.getState();
      if (event.code === "KeyB" && !event.repeat) {
        event.preventDefault();
        if (state.role !== "SURVIVOR") setInteractionMessage("바리케이드는 시민만 설치할 수 있습니다.");
        else { setInteractionMessage("바라보는 앞에 경보 바리케이드를 설치합니다."); getActiveGameClient()?.environment("BARRICADE_DEPLOY"); }
        return;
      }
      if (state.role === "MAFIA" && (event.code === "KeyQ" || event.code === "KeyF")) {
        event.preventDefault();
        const targets = nearbyKillTargetIds.current;
        if (event.code === "KeyQ") {
          if (!targets.length) { setInteractionMessage("처치 거리 안에 시민이 없습니다."); return; }
          const currentIndex = targets.indexOf(aimedTargetId.current ?? "");
          const targetId = targets[(currentIndex + 1) % targets.length];
          manuallySelectedTargetId.current = targetId;
          aimedTargetId.current = targetId;
          setAimedKillTarget(targetId);
          const target = state.room?.players.find((player) => player.id === targetId);
          setInteractionMessage(`${target?.displayName ?? "시민"} 선택 · [F] 또는 좌클릭으로 처치`);
        } else {
          const action = findPrimaryAction(undefined, state.role, state.aimedKillTargetId, targets);
          if (action?.type === "KILL") getActiveGameClient()?.kill(action.targetId);
          else setInteractionMessage("처치 거리 안의 시민을 찾지 못했습니다.");
        }
        return;
      }
      if (event.code !== "KeyE" || event.repeat || repairActive.current) return;
      const position = localPosition.current; const nearbyBarricade = (state.environment?.barricades ?? []).find((barricade) => Math.hypot(position.x - barricade.position.x, position.z - barricade.position.z) <= 2);
      if (state.role === "MAFIA" && nearbyBarricade) { setInteractionMessage("경보 바리케이드를 해체합니다."); getActiveGameClient()?.environment("BARRICADE_DISMANTLE"); return; }
      const direction = new THREE.Vector3(); camera.getWorldDirection(direction);
      const device = position ? findCrosshairInteractable(position, direction, devices) ?? findNearbyInteractable(position, devices) : undefined;
      if (!device) { setInteractionMessage("장치를 크로스헤어로 조준한 뒤 [E]를 누르세요."); return; }
      if (device.type === "BELL") { setInteractionMessage("긴급 회의 종을 울립니다."); getActiveGameClient()?.callMeeting(); return; }
      if (device.type === "TASK_PANEL") { if (state.role !== "SURVIVOR") setInteractionMessage("회로 제어반은 시민만 사용할 수 있습니다."); else { document.exitPointerLock(); setTaskPanelOpen(true); } return; }
      if (device.type === "SECURITY_CARD") { if (state.role !== "SURVIVOR") setInteractionMessage("보안 카드 인증은 시민만 수행할 수 있습니다."); else if (state.environment?.securityCardCompletedIds.includes(state.playerId ?? "")) setInteractionMessage("이번 판의 보안 카드 인증을 이미 완료했습니다."); else { document.exitPointerLock(); setSecurityCardPanelOpen(true); } return; }
      if (device.type === "CARGO_PICKUP") { if (state.role !== "SURVIVOR") setInteractionMessage("보급 물품은 시민만 획득할 수 있습니다."); else { setInteractionMessage("보급 물품 획득을 서버에 요청합니다."); getActiveGameClient()?.environment("CARGO_PICKUP"); } return; }
      if (device.type === "CARGO_DELIVERY") { if (state.role !== "SURVIVOR") setInteractionMessage("납품은 시민만 할 수 있습니다."); else { setInteractionMessage("통신실 납품을 서버에 요청합니다."); getActiveGameClient()?.environment("CARGO_DELIVER"); } return; }
      if (device.type === "CCTV") { if (state.role !== "SURVIVOR" || !state.environment?.cctvOnline) setInteractionMessage("CCTV는 전력이 정상일 때 시민만 사용할 수 있습니다."); else { document.exitPointerLock(); getActiveGameClient()?.environment("CCTV_OPEN"); setCctvOpen(true); } return; }
      if (device.type === "COMMUNICATIONS") { if (state.role !== "SURVIVOR" || state.environment?.communicationsOnline) setInteractionMessage("통신 장치는 현재 복구가 필요하지 않습니다."); else { setInteractionMessage("통신을 복구합니다."); getActiveGameClient()?.environment("COMM_REPAIR"); } return; }
      if (device.type === "DOOR") { getActiveGameClient()?.environment(state.role === "MAFIA" ? "DOOR_LOCK" : "DOOR_TOGGLE"); return; }
      if (device.type === "VENT") { if (state.role !== "MAFIA") setInteractionMessage("환풍구는 마피아만 사용할 수 있습니다."); else { setInteractionMessage("환풍구를 통해 반대편 출구로 이동합니다."); getActiveGameClient()?.environment("VENT"); } return; }
      if (device.type !== "GENERATOR" || state.role !== "SURVIVOR" || !state.environment?.blackout) { setInteractionMessage(`${device.name}은 지금 상호작용할 수 없습니다.`); return; }
      repairActive.current = true;
      repairStartedAt.current = performance.now();
      setRepairProgress(0);
      getActiveGameClient()?.environment("REPAIR_START", device.id as GeneratorId);
      repairProgressTimer.current = window.setInterval(() => setRepairProgress((performance.now() - repairStartedAt.current) / REPAIR_HOLD_DURATION_MS), 40);
      repairTimer.current = window.setTimeout(() => {
        if (!repairActive.current) return;
        repairActive.current = false;
        repairTimer.current = undefined;
        if (repairProgressTimer.current !== undefined) window.clearInterval(repairProgressTimer.current);
        repairProgressTimer.current = undefined;
        setRepairProgress(0);
        getActiveGameClient()?.environment("REPAIR_COMPLETE", device.id as GeneratorId);
      }, REPAIR_HOLD_DURATION_MS + 150);
    };
    /** 키를 이동 입력 집합에서 제거하고 진행 중인 복구를 취소한다. */
    const onKeyUp = (event: KeyboardEvent) => {
      pressed.current.delete(event.code);
      if (event.code !== "KeyE" || !repairActive.current) return;
      repairActive.current = false;
      if (repairTimer.current !== undefined) { window.clearTimeout(repairTimer.current); repairTimer.current = undefined; }
      if (repairProgressTimer.current !== undefined) { window.clearInterval(repairProgressTimer.current); repairProgressTimer.current = undefined; }
      setRepairProgress(0);
      getActiveGameClient()?.environment("REPAIR_CANCEL");
    };
    /** 게임 캔버스 클릭으로 처치 또는 가까운 시체 신고를 요청한다. */
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || (event.target !== gl.domElement && document.pointerLockElement !== gl.domElement)) return;
      requestPrimaryAction();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("mousedown", onMouseDown, true); if (repairTimer.current !== undefined) window.clearTimeout(repairTimer.current); if (repairProgressTimer.current !== undefined) window.clearInterval(repairProgressTimer.current); setRepairProgress(0); if (repairActive.current) getActiveGameClient()?.environment("REPAIR_CANCEL"); };
  }, [camera, gl, setAimedKillTarget, setInteractionMessage, setRepairProgress]);

  useEffect(() => {
    if (lifeState !== "ALIVE" && document.pointerLockElement === gl.domElement) document.exitPointerLock();
  }, [gl, lifeState]);

  useFrame((_state, delta) => {
    const state = useGameStore.getState();
    if (state.cctvOpen) return;
    // 회의 중에도 캔버스는 유지하되, 회의 화면 아래에서 이동하거나 상호작용하지 않는다.
    if (state.room?.gameState !== "PLAYING") return;
    const localPlayer = state.room?.players.find((item) => item.id === state.playerId);
    if (localPlayer?.lifeState !== "ALIVE") {
      const alivePlayers = state.room?.players.filter((item) => item.id !== state.playerId && item.connected && item.lifeState === "ALIVE") ?? [];
      const observed = alivePlayers.find((item) => item.id === spectatorTargetId) ?? alivePlayers[0];
      if (observed) {
        if (spectatorTargetId !== observed.id) setSpectatorTarget(observed.id);
        const destination = new THREE.Vector3(observed.position.x, observed.position.y + 5, observed.position.z + 6);
        camera.position.lerp(destination, 0.08);
        camera.lookAt(observed.position.x, observed.position.y + 0.8, observed.position.z);
      }
      setNearbyBody(undefined);
      setAimedKillTarget(undefined);
      return;
    }
    if (!player.current) return;
    const authoritativePosition = localPlayer?.position;
    const environment = state.environment;
    const locallyBlocked = !isWalkablePosition(localPosition.current, environment?.doorState !== "OPEN", environment?.barricades ?? []);
    if (authoritativePosition && (Math.hypot(localPosition.current.x - authoritativePosition.x, localPosition.current.z - authoritativePosition.z) > 10 || locallyBlocked)) {
      localPosition.current = { ...authoritativePosition };
      player.current.position.set(authoritativePosition.x, authoritativePosition.y, authoritativePosition.z);
      camera.position.set(authoritativePosition.x, authoritativePosition.y + 0.65, authoritativePosition.z);
    }
    const input = readMovementInput(pressed.current);
    const direction = movementVector(input);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < Number.EPSILON) forward.set(0, 0, -1);
    else forward.normalize();
    const heading = forward.clone();
    const right = new THREE.Vector3(-heading.z, 0, heading.x);
    const velocity = heading.clone().multiplyScalar(-direction.z).add(right.multiplyScalar(direction.x)).multiplyScalar(movementSpeed(input.run));
    const position = resolveLocalMovement(localPosition.current, { x: velocity.x * Math.min(delta, 0.05), z: velocity.z * Math.min(delta, 0.05) }, environment?.doorState !== "OPEN", environment?.barricades);
    localPosition.current = position;
    player.current.position.set(position.x, position.y, position.z);
    camera.position.set(position.x, position.y + 0.65, position.z);
    setPlayerPosition(position);
    const cameraDirection = new THREE.Vector3(); camera.getWorldDirection(cameraDirection);
    setNearbyDevice(findCrosshairInteractable(position, cameraDirection, devices) ?? findNearbyInteractable(position, devices));
    const nearbyBody = state.room?.players.filter((item) => item.lifeState === "DEAD" && item.bodyId).map((item) => ({ bodyId: item.bodyId!, distance: Math.hypot(position.x - item.position.x, position.z - item.position.z) })).sort((left, right) => left.distance - right.distance)[0];
    setNearbyBody(nearbyBody && nearbyBody.distance <= 2 ? nearbyBody.bodyId : undefined);
    const targets = state.role === "MAFIA" && Date.now() >= (state.killCooldownUntil ?? 0)
      ? findNearbyKillTargets(position, state.room?.players ?? [], state.mafiaIds)
      : [];
    const targetIds = targets.map((target) => target.id);
    if (nearbyKillTargetIds.current.join(",") !== targetIds.join(",")) { nearbyKillTargetIds.current = targetIds; setKillTargetIds(targetIds); }
    const selectedTarget = manuallySelectedTargetId.current ? targets.find((target) => target.id === manuallySelectedTargetId.current) : undefined;
    if (!selectedTarget) manuallySelectedTargetId.current = undefined;
    const target = selectedTarget ?? findCrosshairKillTarget(position, cameraDirection, targets, state.mafiaIds) ?? targets[0];
    const nextTargetId = target?.id;
    if (aimedTargetId.current !== nextTargetId) { aimedTargetId.current = nextTargetId; setAimedKillTarget(nextTargetId); }
    const now = performance.now();
    if (now - lastSendAt.current >= 1000 / 15) { lastSendAt.current = now; getActiveGameClient()?.move({ x: velocity.x / movementSpeed(input.run), z: velocity.z / movementSpeed(input.run) }, facingYaw(heading), input.run, ++sequence.current); }
  });

  if (lifeState !== "ALIVE") return null;
  return <group ref={player} position={[localPosition.current.x, localPosition.current.y, localPosition.current.z]}><mesh castShadow><capsuleGeometry args={[0.35, 1, 8, 16]} /><meshStandardMaterial color="#e8eef7" /></mesh></group>;
}

/** 운송 물품을 든 참가자에게 표시할 상자 모델이다. */
function CargoCrate() { return <group position={[0.48, 0.65, -0.38]} rotation={[0, 0.35, 0]}><mesh castShadow><boxGeometry args={[0.42, 0.34, 0.3]} /><meshStandardMaterial color="#c47a2c" /></mesh><Text position={[0, 0.34, 0]} fontSize={0.12} color="#ffedd5" anchorX="center">물품</Text></group>; }

/** 서버에서 전파한 살아 있는 다른 참가자와 이름표를 표시한다.
 * @returns 원격 참가자 메시 목록
 */
function RemotePlayers() {
  const players = useGameStore((state) => state.room?.players) ?? [];
  const playerId = useGameStore((state) => state.playerId);
  const cargoCarrierIds = useGameStore((state) => state.environment?.cargoCarrierIds) ?? [];
  return <>{players.filter((player) => player.id !== playerId && player.connected && player.lifeState === "ALIVE").map((player) => <RemotePlayer key={player.id} playerId={player.id} position={player.position} rotation={player.rotation} name={player.displayName} carryingCargo={cargoCarrierIds.includes(player.id)} />)}</>;
}

/** 서버가 남긴 시체를 표시한다. 살아 있는 모든 참가자는 가까이 가면 신고할 수 있다. */
function Bodies() {
  const players = useGameStore((state) => state.room?.players) ?? [];
  return <>{players.filter((player) => player.lifeState === "DEAD" && player.bodyId).map((player) => <Body key={player.bodyId} bodyId={player.bodyId!} position={player.position} name={player.displayName} />)}</>;
}

/** 바닥에 남은 시체와 근접 신고 가능 강조를 그린다. */
function Body({ bodyId, position, name }: { bodyId: string; position: Vector3Data; name: string }) {
  const nearbyBodyId = useGameStore((state) => state.nearbyBodyId);
  const highlighted = nearbyBodyId === bodyId;
  return <group position={[position.x, 0.34, position.z]} rotation={[Math.PI / 2, 0, 0]}><mesh castShadow userData={{ reportBodyId: bodyId }}><capsuleGeometry args={[0.36, 0.9, 8, 16]} /><meshStandardMaterial color="#7f1d1d" emissive={highlighted ? "#ef4444" : "#000000"} emissiveIntensity={highlighted ? 0.8 : 0} /><Outlines color="#fbbf24" thickness={0.12} screenspace visible={highlighted} /></mesh><Billboard position={[0, 0.8, 0]} follow><Text fontSize={0.25} color={highlighted ? "#fef3c7" : "#fecaca"} outlineWidth={0.018} outlineColor="#1f0707" anchorX="center">{highlighted ? `[좌클릭] ${name} 신고` : `${name}의 시체`}</Text></Billboard></group>;
}

/** 다른 참가자 위치를 보간하고 처치 가능한 시민을 강조한다.
 * @param position 서버가 전파한 목표 위치
 * @param name 표시할 참가자 이름
 * @param playerId 목표 참가자 식별자
 * @param rotation 서버가 확정한 바라보는 방향
 * @returns 참가자 모델과 이름표
 */
function RemotePlayer({ position, rotation, name, playerId, carryingCargo }: { position: { x: number; y: number; z: number }; rotation: number; name: string; playerId: string; carryingCargo: boolean }) {
  const group = useRef<THREE.Group>(null);
  const role = useGameStore((state) => state.role);
  const mafiaIds = useGameStore((state) => state.mafiaIds);
  const aimedKillTargetId = useGameStore((state) => state.aimedKillTargetId);
  const killCooldownUntil = useGameStore((state) => state.killCooldownUntil ?? 0);
  const localPosition = useGameStore((state) => state.playerPosition);
  const isCitizen = !mafiaIds.includes(playerId);
  const isKillable = role === "MAFIA" && Date.now() >= killCooldownUntil && isCitizen && aimedKillTargetId === playerId && Math.hypot(localPosition.x - position.x, localPosition.z - position.z) <= KILL_RANGE;
  useFrame(() => {
    if (!group.current) return;
    group.current.position.lerp(new THREE.Vector3(position.x, position.y, position.z), 0.16);
    group.current.rotation.y += shortestAngleDelta(group.current.rotation.y, rotation) * 0.16;
  });
  return <group ref={group} position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]}><mesh castShadow userData={{ killTargetId: playerId }}><capsuleGeometry args={[0.35, 1, 8, 16]} /><meshStandardMaterial color={isKillable ? "#ffd3d3" : "#65d9ff"} /><Outlines color="#ff365f" thickness={0.08} screenspace visible={isKillable} /></mesh><mesh position={[0, 0.34, -0.37]} castShadow><boxGeometry args={[0.28, 0.14, 0.08]} /><meshStandardMaterial color="#e8f7ff" emissive="#2aa7db" emissiveIntensity={0.7} /></mesh>{carryingCargo ? <CargoCrate /> : null}<NameLabel name={name} /></group>;
}

/** 두 수평 회전값 사이의 가장 짧은 보간 각도를 반환한다.
 * @param current 현재 회전값
 * @param target 서버가 확정한 목표 회전값
 * @returns -파이부터 파이 사이의 회전 차이
 */
function shortestAngleDelta(current: number, target: number): number { return THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI; }

/** 참가자 머리 위에 배경 상자 없이 카메라를 향하는 이름을 표시한다.
 * @param name 표시할 참가자 이름
 * @returns 3차원 이름표
 */
function NameLabel({ name }: { name: string }) { return <Billboard position={[0, 1.35, 0]} follow><Text fontSize={0.24} color="#ffffff" outlineWidth={0.018} outlineColor="#071018" anchorX="center" anchorY="middle">{name}</Text></Billboard>; }

/** 정전 중 시민 진영 카메라에만 안개와 시야 절단 거리를 적용한다.
 * @returns 화면에 별도 메시를 만들지 않는다
 */
function BlackoutVision() {
  const blackout = useGameStore((state) => state.environment?.blackout ?? false);
  const role = useGameStore((state) => state.role);
  const { camera, scene } = useThree();
  const limited = blackout && role === "SURVIVOR";

  useEffect(() => {
    camera.far = 260;
    camera.updateProjectionMatrix();
    scene.fog = limited ? new THREE.Fog("#05070a", 2.2, SURVIVOR_BLACKOUT_VIEW_DISTANCE) : null;
    return () => { scene.fog = null; camera.far = 260; camera.updateProjectionMatrix(); };
  }, [camera, limited, scene]);

  return null;
}

/** 게임이 시작되면 3D 캔버스에 포커스와 포인터 잠금을 요청한다.
 * @param state React Three Fiber 렌더러 상태
 * @returns 없음
 */
function focusGameCanvas({ gl }: RootState): void {
  const canvas = gl.domElement;
  canvas.tabIndex = 0;
  canvas.focus();
  if (document.visibilityState === "visible" && document.hasFocus()) void canvas.requestPointerLock().catch(() => undefined);
}

/** 사망한 참가자가 카메라를 고정 관전에 쓰도록 포인터 잠금 조작을 제어한다. */
function GamePointerLockControls() {
  const lifeState = useGameStore((state) => state.room?.players.find((player) => player.id === state.playerId)?.lifeState);
  return <PointerLockControls enabled={lifeState === "ALIVE"} />;
}

/** 서쪽 숲과 동쪽 산업 지대를 잇는 180미터 야외 맵을 렌더링한다.
 * @returns React Three Fiber 캔버스
 */
export function World() { return <Canvas shadows camera={{ position: [0, 2, 7], fov: 75 }} onCreated={focusGameCanvas} onPointerDown={(event) => { if (event.button === 0) requestPrimaryAction(); }}><color attach="background" args={["#87b7d1"]} /><ambientLight intensity={1.1} /><hemisphereLight intensity={1.35} color="#e7f3ff" groundColor="#35582d" /><directionalLight castShadow intensity={1.8} position={[40, 70, 20]} shadow-mapSize={[2048, 2048]} /><BlackoutVision /><GeneratorBlackoutOutline /><Physics gravity={[0, -18, 0]}><Block position={[0, -0.15, 0]} size={[WORLD_WIDTH, 0.3, WORLD_DEPTH]} color="#496b3c" /><OutdoorLandmarks />{WORLD_COLLIDERS.filter((collider) => !collider.id.startsWith("river-")).map((collider) => <Block key={collider.id} position={[collider.position.x, collider.position.y, collider.position.z]} size={[collider.size.x, collider.size.y, collider.size.z]} color={collider.id.includes("station") ? "#56616b" : collider.id.endsWith("wall") ? "#6e6556" : "#8a6a59"} />)}{devices.map((device) => <Device key={device.id} device={device} />)}<Barricades /><PlayerController /><RemotePlayers /><Bodies /></Physics><GamePointerLockControls /></Canvas>; }
