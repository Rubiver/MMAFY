import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import type { InteractableState } from "@mafia/shared";
import { GAME_CONFIG } from "./config";
import { readMovementInput } from "./input";
import { findNearbyInteractable } from "./interactions";
import { movementSpeed, movementVector } from "./movement";
import { useGameStore } from "../store/gameStore";
import { getActiveGameClient } from "../network/gameClient";

const devices: InteractableState[] = [
  { id: "generator-a", name: "발전기 A", type: "GENERATOR", position: { x: -4, y: 0, z: -5 }, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "hall-door", name: "발전실 문", type: "DOOR", position: { x: -1.5, y: 0, z: -1 }, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
  { id: "maintenance-ladder", name: "정비 사다리", type: "LADDER", position: { x: 5, y: 0, z: -5 }, interactionRange: GAME_CONFIG.interactionRange, currentState: "READY" },
];

/** 바닥이나 벽에 쓸 단순한 충돌 상자를 만든다.
 * @param position 상자 중심 위치
 * @param size 상자의 가로, 세로, 깊이
 * @param color 화면 표시 색
 * @returns 맵 장애물 메시
 */
function Block({ position, size, color = "#263647" }: { position: [number, number, number]; size: [number, number, number]; color?: string }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </RigidBody>
  );
}

/** 플레이어가 가까이 갔을 때 장치 위치에 표식을 렌더링한다.
 * @param device 표시할 장치 상태
 * @returns 장치 메시와 표식
 */
function Device({ device }: { device: InteractableState }) {
  const colors = { GENERATOR: "#f4b942", DOOR: "#4ca7e8", LADDER: "#81c784" };
  return (
    <group position={[device.position.x, 0, device.position.z]}>
      {device.type === "LADDER" ? <Block position={[0, 1.4, 0]} size={[0.45, 2.8, 0.2]} color={colors.LADDER} /> : null}
      {device.type === "GENERATOR" ? <Block position={[0, 0.65, 0]} size={[1.1, 1.3, 0.8]} color={colors.GENERATOR} /> : null}
      {device.type === "DOOR" ? <Block position={[0, 1.3, 0]} size={[0.25, 2.6, 2.4]} color={colors.DOOR} /> : null}
      <pointLight color={colors[device.type]} intensity={2} distance={3} position={[0, 1.8, 0]} />
    </group>
  );
}

/** 키보드와 마우스 입력으로 물리 플레이어를 이동하고 카메라를 따라가게 한다.
 * @returns 플레이어 물리 본체
 */
function PlayerController() {
  const body = useRef<RapierRigidBody>(null);
  const pressed = useRef(new Set<string>());
  const setPlayerPosition = useGameStore((state) => state.setPlayerPosition);
  const setNearbyDevice = useGameStore((state) => state.setNearbyDevice);
  const setInteractionMessage = useGameStore((state) => state.setInteractionMessage);
  const { camera } = useThree();
  const lastSendAt = useRef(0);
  const sequence = useRef(0);

  useEffect(() => {
    /** 키를 이동 입력 집합에 추가하고 E 상호작용을 처리한다. */
    const onKeyDown = (event: KeyboardEvent) => {
      pressed.current.add(event.code);
      if (event.code === "KeyE" && !event.repeat) {
        const device = useGameStore.getState().nearbyDevice;
        if (device) setInteractionMessage(`${device.name} 점검을 시작했습니다.`);
      }
    };
    /** 키를 이동 입력 집합에서 제거한다. */
    const onKeyUp = (event: KeyboardEvent) => pressed.current.delete(event.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame(() => {
    if (!body.current) return;
    const input = readMovementInput(pressed.current);
    const direction = movementVector(input);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const velocity = forward.multiplyScalar(-direction.z).add(right.multiplyScalar(direction.x)).multiplyScalar(movementSpeed(input.run));
    const currentVelocity = body.current.linvel();
    body.current.setLinvel({ x: velocity.x, y: currentVelocity.y, z: velocity.z }, true);
    const translation = body.current.translation();
    const position = { x: translation.x, y: translation.y, z: translation.z };
    camera.position.set(position.x, position.y + 0.65, position.z);
    setPlayerPosition(position);
    setNearbyDevice(findNearbyInteractable(position, devices));
    const now = performance.now();
    if (now - lastSendAt.current >= 1000 / 15) {
      lastSendAt.current = now;
      getActiveGameClient()?.move({ x: velocity.x / movementSpeed(input.run || false), z: velocity.z / movementSpeed(input.run || false) }, camera.rotation.y, ++sequence.current);
    }
  });

  return (
    <RigidBody ref={body} colliders={false} position={[0, GAME_CONFIG.playerHeight, 4]} enabledRotations={[false, false, false]}>
      <CuboidCollider args={[0.35, GAME_CONFIG.playerHeight, 0.35]} />
      <mesh castShadow>
        <capsuleGeometry args={[0.35, 1, 8, 16]} />
        <meshStandardMaterial color="#e8eef7" />
      </mesh>
    </RigidBody>
  );
}

/** 서버에서 전파한 다른 참가자를 부드럽게 표시한다. */
function RemotePlayers() {
  const players = useGameStore((state) => state.room?.players ?? []);
  const playerId = useGameStore((state) => state.playerId);
  return <>{players.filter((player) => player.id !== playerId && player.connected && player.lifeState === "ALIVE").map((player) => <RemotePlayer key={player.id} playerId={player.id} position={player.position} name={player.displayName} />)}</>;
}

/** 다른 참가자 위치를 보간해 렌더링한다. */
function RemotePlayer({ position, name, playerId }: { position: { x: number; y: number; z: number }; name: string; playerId: string }) {
  const group = useRef<THREE.Group>(null);
  const role = useGameStore((state) => state.role);
  useFrame(() => { if (group.current) group.current.position.lerp(new THREE.Vector3(position.x, position.y, position.z), 0.16); });
  /** 마피아만 클릭한 원격 참가자 처치를 서버에 요청한다. */
  const requestKill = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (role === "MAFIA") getActiveGameClient()?.kill(playerId); };
  return <group ref={group} position={[position.x, position.y, position.z]}><mesh castShadow onClick={requestKill}><capsuleGeometry args={[0.35, 1, 8, 16]} /><meshStandardMaterial color={role === "MAFIA" ? "#ff7d7d" : "#65d9ff"} /></mesh><HtmlLabel name={name} /></group>;
}

/** 원격 참가자의 이름을 간결하게 표시한다. */
function HtmlLabel({ name }: { name: string }) { return <sprite position={[0, 1.2, 0]}><spriteMaterial color="#ffffff" /></sprite>; }

/** 중앙홀과 발전실을 포함한 시험용 3D 맵을 렌더링한다.
 * @returns Three.js 캔버스
 */
export function World() {
  return (
    <Canvas shadows camera={{ position: [0, 2, 7], fov: 75 }}>
      <color attach="background" args={["#071018"]} />
      <ambientLight intensity={0.45} />
      <directionalLight castShadow intensity={1.4} position={[4, 8, 2]} shadow-mapSize={[1024, 1024]} />
      <Physics gravity={[0, -18, 0]}>
        <Block position={[0, -0.15, 0]} size={[20, 0.3, 16]} color="#162534" />
        <Block position={[0, 1.5, -8]} size={[20, 3, 0.35]} />
        <Block position={[0, 1.5, 8]} size={[20, 3, 0.35]} />
        <Block position={[-10, 1.5, 0]} size={[0.35, 3, 16]} />
        <Block position={[10, 1.5, 0]} size={[0.35, 3, 16]} />
        <Block position={[1.5, 0.6, 1.5]} size={[2.2, 1.2, 1.8]} />
        <Block position={[-5.8, 1, -2.5]} size={[1.4, 2, 3.5]} />
        {devices.map((device) => <Device key={device.id} device={device} />)}
        <PlayerController />
        <RemotePlayers />
      </Physics>
      <PointerLockControls />
    </Canvas>
  );
}
