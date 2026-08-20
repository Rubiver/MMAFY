import { useEffect, useRef } from "react";
import { Billboard, Outlines, PointerLockControls, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { GENERATOR_POSITIONS, KILL_RANGE, REPAIR_HOLD_DURATION_MS, SURVIVOR_BLACKOUT_VIEW_DISTANCE, TREE_POSITIONS, VENT_ENTRANCE_POSITION, WORLD_COLLIDERS, WORLD_DEPTH, WORLD_WIDTH, type GeneratorId, type InteractableState, type Vector3Data } from "@mafia/shared";
import { getActiveGameClient } from "../network/gameClient";
import { useGameStore } from "../store/gameStore";
import { GAME_CONFIG } from "./config";
import { readMovementInput } from "./input";
import { findCrosshairInteractable } from "./interactions";
import { facingYaw, movementSpeed, movementVector } from "./movement";
import { resolveLocalMovement } from "./localMovement";

const devices: InteractableState[] = [
  { id: "generator-a", name: "발전기 A", type: "GENERATOR", position: GENERATOR_POSITIONS["generator-a"], interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "generator-b", name: "발전기 B", type: "GENERATOR", position: GENERATOR_POSITIONS["generator-b"], interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "maintenance-ladder", name: "정비 사다리", type: "LADDER", position: { x: 72, y: 0, z: -36 }, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "forest-vent", name: "숲 환풍구", type: "VENT", position: VENT_ENTRANCE_POSITION, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
];

/** 바닥이나 벽에 쓸 단순한 충돌 상자를 만든다.
 * @param position 상자 중심 위치
 * @param size 상자의 가로, 세로, 깊이
 * @param color 화면 표시 색
 * @returns 맵 장애물 메시
 */
function Block({ position, size, color = "#263647" }: { position: [number, number, number]; size: [number, number, number]; color?: string }) {
  return <RigidBody type="fixed" colliders={false}><CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} /><mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.8} /></mesh></RigidBody>;
}

/** 맵 장치와 장치별 조명을 표시한다.
 * @param device 표시할 장치 상태
 * @returns 장치 메시와 조명
 */
function Device({ device }: { device: InteractableState }) {
  const colors = { GENERATOR: "#f4b942", DOOR: "#4ca7e8", LADDER: "#81c784", VENT: "#a78bfa" };
  return <group position={[device.position.x, 0, device.position.z]}>{device.type === "LADDER" ? <Block position={[0, 1.4, 0]} size={[0.45, 2.8, 0.2]} color={colors.LADDER} /> : null}{device.type === "GENERATOR" ? <Block position={[0, 0.65, 0]} size={[1.1, 1.3, 0.8]} color={colors.GENERATOR} /> : null}{device.type === "DOOR" ? <Block position={[0, 1.3, 0]} size={[0.25, 2.6, 2.4]} color={colors.DOOR} /> : null}{device.type === "VENT" ? <group position={[0, 0.12, 0]}><mesh><cylinderGeometry args={[1.05, 1.05, 0.22, 24]} /><meshStandardMaterial color={colors.VENT} metalness={0.7} roughness={0.28} /></mesh><mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.72, 0.08, 8, 24]} /><meshStandardMaterial color="#e9d5ff" emissive="#7c3aed" emissiveIntensity={0.55} /></mesh></group> : null}<pointLight color={colors[device.type]} intensity={2} distance={5} position={[0, 1.8, 0]} /></group>;
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
  const setNearbyBody = useGameStore((state) => state.setNearbyBody);
  const setRepairProgress = useGameStore((state) => state.setRepairProgress);
  const { camera, scene } = useThree();
  const lastSendAt = useRef(0);
  const sequence = useRef(0);
  const repairTimer = useRef<number | undefined>(undefined);
  const repairProgressTimer = useRef<number | undefined>(undefined);
  const repairActive = useRef(false);
  const repairStartedAt = useRef(0);
  const aimedTargetId = useRef<string | undefined>(undefined);
  const raycaster = useRef(new THREE.Raycaster());
  const spawnPosition = useGameStore((state) => state.room?.players.find((player) => player.id === state.playerId)?.position);
  const localPosition = useRef<Vector3Data>(spawnPosition ?? { x: 0, y: GAME_CONFIG.playerHeight, z: 4 });

  useEffect(() => {
    /** 키를 이동 입력 집합에 추가하고, 조준한 발전기의 복구를 시작한다. */
    const onKeyDown = (event: KeyboardEvent) => {
      pressed.current.add(event.code);
      if (event.code !== "KeyE" || event.repeat || repairActive.current) return;
      const position = localPosition.current; const direction = new THREE.Vector3(); camera.getWorldDirection(direction);
      const device = position ? findCrosshairInteractable(position, direction, devices) : undefined;
      if (!device) { setInteractionMessage("장치를 크로스헤어로 조준한 뒤 [E]를 누르세요."); return; }
      const state = useGameStore.getState();
      if (device.type === "VENT") { if (state.role !== "MAFIA") setInteractionMessage("환풍구는 마피아만 사용할 수 있습니다."); else { setInteractionMessage("환풍구를 통해 동쪽 출구로 이동합니다."); getActiveGameClient()?.environment("VENT"); } return; }
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
      }, REPAIR_HOLD_DURATION_MS);
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
    /** 포인터 잠금 중 좌클릭으로 처치 또는 가까운 시체 신고를 요청한다. */
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || !(document.pointerLockElement instanceof HTMLCanvasElement)) return;
      const state = useGameStore.getState();
      if (state.role === "MAFIA" && state.aimedKillTargetId) getActiveGameClient()?.kill(state.aimedKillTargetId);
      else if (state.nearbyBodyId) getActiveGameClient()?.report(state.nearbyBodyId);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("mousedown", onMouseDown); if (repairTimer.current !== undefined) window.clearTimeout(repairTimer.current); if (repairProgressTimer.current !== undefined) window.clearInterval(repairProgressTimer.current); setRepairProgress(0); if (repairActive.current) getActiveGameClient()?.environment("REPAIR_CANCEL"); };
  }, [camera, setAimedKillTarget, setInteractionMessage, setRepairProgress]);

  useFrame((_state, delta) => {
    if (!player.current) return;
    const authoritativePosition = useGameStore.getState().room?.players.find((item) => item.id === useGameStore.getState().playerId)?.position;
    if (authoritativePosition && Math.hypot(localPosition.current.x - authoritativePosition.x, localPosition.current.z - authoritativePosition.z) > 10) {
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
    const position = resolveLocalMovement(localPosition.current, { x: velocity.x * Math.min(delta, 0.05), z: velocity.z * Math.min(delta, 0.05) });
    localPosition.current = position;
    player.current.position.set(position.x, position.y, position.z);
    camera.position.set(position.x, position.y + 0.65, position.z);
    setPlayerPosition(position);
    const cameraDirection = new THREE.Vector3(); camera.getWorldDirection(cameraDirection);
    setNearbyDevice(findCrosshairInteractable(position, cameraDirection, devices));
    const state = useGameStore.getState();
    const nearbyBody = state.room?.players.filter((item) => item.lifeState === "DEAD" && item.bodyId).map((item) => ({ bodyId: item.bodyId!, distance: Math.hypot(position.x - item.position.x, position.z - item.position.z) })).sort((left, right) => left.distance - right.distance)[0];
    setNearbyBody(nearbyBody && nearbyBody.distance <= 2 ? nearbyBody.bodyId : undefined);
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = state.role === "MAFIA" && Date.now() >= (state.killCooldownUntil ?? 0) ? raycaster.current.intersectObjects(scene.children, true).find((intersection) => typeof intersection.object.userData.killTargetId === "string") : undefined;
    const targetId = hit?.object.userData.killTargetId as string | undefined;
    const target = targetId ? state.room?.players.find((player) => player.id === targetId) : undefined;
    const canKillTarget = target && target.lifeState === "ALIVE" && !state.mafiaIds.includes(target.id) && Math.hypot(position.x - target.position.x, position.z - target.position.z) <= KILL_RANGE;
    const nextTargetId = canKillTarget ? targetId : undefined;
    if (aimedTargetId.current !== nextTargetId) { aimedTargetId.current = nextTargetId; setAimedKillTarget(nextTargetId); }
    const now = performance.now();
    if (now - lastSendAt.current >= 1000 / 15) { lastSendAt.current = now; getActiveGameClient()?.move({ x: velocity.x / movementSpeed(input.run), z: velocity.z / movementSpeed(input.run) }, facingYaw(heading), input.run, ++sequence.current); }
  });

  return <group ref={player} position={[localPosition.current.x, localPosition.current.y, localPosition.current.z]}><mesh castShadow><capsuleGeometry args={[0.35, 1, 8, 16]} /><meshStandardMaterial color="#e8eef7" /></mesh></group>;
}

/** 서버에서 전파한 살아 있는 다른 참가자와 이름표를 표시한다.
 * @returns 원격 참가자 메시 목록
 */
function RemotePlayers() {
  const players = useGameStore((state) => state.room?.players ?? []);
  const playerId = useGameStore((state) => state.playerId);
  return <>{players.filter((player) => player.id !== playerId && player.connected && player.lifeState === "ALIVE").map((player) => <RemotePlayer key={player.id} playerId={player.id} position={player.position} rotation={player.rotation} name={player.displayName} />)}</>;
}

/** 서버가 남긴 시체를 표시한다. 살아 있는 모든 참가자는 가까이 가면 신고할 수 있다. */
function Bodies() {
  const players = useGameStore((state) => state.room?.players ?? []);
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
function RemotePlayer({ position, rotation, name, playerId }: { position: { x: number; y: number; z: number }; rotation: number; name: string; playerId: string }) {
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
  return <group ref={group} position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]}><mesh castShadow userData={{ killTargetId: playerId }}><capsuleGeometry args={[0.35, 1, 8, 16]} /><meshStandardMaterial color={isKillable ? "#ffd3d3" : "#65d9ff"} /><Outlines color="#ff365f" thickness={0.08} screenspace visible={isKillable} /></mesh><mesh position={[0, 0.34, -0.37]} castShadow><boxGeometry args={[0.28, 0.14, 0.08]} /><meshStandardMaterial color="#e8f7ff" emissive="#2aa7db" emissiveIntensity={0.7} /></mesh><NameLabel name={name} /></group>;
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
  void canvas.requestPointerLock();
}

/** 서쪽 숲과 동쪽 산업 지대를 잇는 180미터 야외 맵을 렌더링한다.
 * @returns React Three Fiber 캔버스
 */
export function World() { return <Canvas shadows camera={{ position: [0, 2, 7], fov: 75 }} onCreated={focusGameCanvas}><color attach="background" args={["#87b7d1"]} /><ambientLight intensity={1.1} /><hemisphereLight intensity={1.35} color="#e7f3ff" groundColor="#35582d" /><directionalLight castShadow intensity={1.8} position={[40, 70, 20]} shadow-mapSize={[2048, 2048]} /><BlackoutVision /><GeneratorBlackoutOutline /><Physics gravity={[0, -18, 0]}><Block position={[0, -0.15, 0]} size={[WORLD_WIDTH, 0.3, WORLD_DEPTH]} color="#496b3c" /><OutdoorLandmarks />{WORLD_COLLIDERS.filter((collider) => !collider.id.startsWith("river-")).map((collider) => <Block key={collider.id} position={[collider.position.x, collider.position.y, collider.position.z]} size={[collider.size.x, collider.size.y, collider.size.z]} color={collider.id.includes("station") ? "#56616b" : collider.id.endsWith("wall") ? "#6e6556" : "#8a6a59"} />)}{devices.map((device) => <Device key={device.id} device={device} />)}<PlayerController /><RemotePlayers /><Bodies /></Physics><PointerLockControls /></Canvas>; }
