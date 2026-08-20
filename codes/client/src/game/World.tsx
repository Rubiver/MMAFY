import { useEffect, useRef } from "react";
import { Billboard, Outlines, PointerLockControls, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { KILL_RANGE, REPAIR_HOLD_DURATION_MS, SURVIVOR_BLACKOUT_VIEW_DISTANCE, WORLD_COLLIDERS, type GeneratorId, type InteractableState, type Vector3Data } from "@mafia/shared";
import { getActiveGameClient } from "../network/gameClient";
import { useGameStore } from "../store/gameStore";
import { GAME_CONFIG } from "./config";
import { readMovementInput } from "./input";
import { findCrosshairInteractable } from "./interactions";
import { facingYaw, movementSpeed, movementVector } from "./movement";
import { resolveLocalMovement } from "./localMovement";

const devices: InteractableState[] = [
  { id: "generator-a", name: "발전기 A", type: "GENERATOR", position: { x: -12, y: 0, z: -8 }, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "generator-b", name: "발전기 B", type: "GENERATOR", position: { x: 12, y: 0, z: 8 }, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "maintenance-ladder", name: "정비 사다리", type: "LADDER", position: { x: 12, y: 0, z: -8 }, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
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
  const colors = { GENERATOR: "#f4b942", DOOR: "#4ca7e8", LADDER: "#81c784" };
  return <group position={[device.position.x, 0, device.position.z]}>{device.type === "LADDER" ? <Block position={[0, 1.4, 0]} size={[0.45, 2.8, 0.2]} color={colors.LADDER} /> : null}{device.type === "GENERATOR" ? <Block position={[0, 0.65, 0]} size={[1.1, 1.3, 0.8]} color={colors.GENERATOR} /> : null}{device.type === "DOOR" ? <Block position={[0, 1.3, 0]} size={[0.25, 2.6, 2.4]} color={colors.DOOR} /> : null}<pointLight color={colors[device.type]} intensity={2} distance={3} position={[0, 1.8, 0]} /></group>;
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
    /** 캔버스 좌클릭 때 크로스헤어가 가리키는 시민만 처치 요청을 보낸다. */
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || !(event.target instanceof HTMLCanvasElement)) return;
      const state = useGameStore.getState();
      if (state.role === "MAFIA" && state.aimedKillTargetId) getActiveGameClient()?.kill(state.aimedKillTargetId);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("mousedown", onMouseDown); if (repairTimer.current !== undefined) window.clearTimeout(repairTimer.current); if (repairProgressTimer.current !== undefined) window.clearInterval(repairProgressTimer.current); setRepairProgress(0); if (repairActive.current) getActiveGameClient()?.environment("REPAIR_CANCEL"); };
  }, [camera, setAimedKillTarget, setInteractionMessage, setRepairProgress]);

  useFrame((_state, delta) => {
    if (!player.current) return;
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
    camera.far = 100;
    camera.updateProjectionMatrix();
    scene.fog = limited ? new THREE.Fog("#05070a", 2.2, SURVIVOR_BLACKOUT_VIEW_DISTANCE) : null;
    return () => { scene.fog = null; camera.far = 100; camera.updateProjectionMatrix(); };
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

/** 중앙 복도와 방으로 구성한 문 없는 단층 주택 맵을 렌더링한다.
 * @returns React Three Fiber 캔버스
 */
export function World() { return <Canvas shadows camera={{ position: [0, 2, 7], fov: 75 }} onCreated={focusGameCanvas}><color attach="background" args={["#10141d"]} /><ambientLight intensity={0.8} /><hemisphereLight intensity={1.15} color="#ffe8cf" groundColor="#5b4030" /><directionalLight castShadow intensity={1.5} position={[4, 8, 2]} shadow-mapSize={[1024, 1024]} /><BlackoutVision /><GeneratorBlackoutOutline /><Physics gravity={[0, -18, 0]}><Block position={[0, -0.15, 0]} size={[36, 0.3, 28]} color="#5d4b40" />{WORLD_COLLIDERS.map((collider) => <Block key={collider.id} position={[collider.position.x, collider.position.y, collider.position.z]} size={[collider.size.x, collider.size.y, collider.size.z]} color={collider.id.endsWith("wall") ? "#8a6a59" : "#a27e69"} />)}{devices.map((device) => <Device key={device.id} device={device} />)}<PlayerController /><RemotePlayers /></Physics><PointerLockControls /></Canvas>; }
