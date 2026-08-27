# 상세 구현 명세

## 1. 기술 구성과 코드 경계

`codes/` 아래에 `client`, `server`, `shared`를 둔다. 클라이언트는 TypeScript, React, Vite, Three.js, React Three Fiber, Drei, Rapier, Zustand를 사용한다. 서버는 Node.js와 TypeScript, Colyseus 또는 동등한 WebSocket 방 구조를 사용한다. 초기 저장소는 SQLite를 쓰고, 규모 확장 시 PostgreSQL과 Redis를 검토한다.

```text
codes/
  client/src/{components,game,network,store,ui}
  server/src/{rooms,game,player,systems,interactions,network}
  shared/{types,constants,protocol}
```

## 2. 권한형 네트워크

서버가 단일 사실 원본이다. 클라이언트는 입력과 화면만 맡는다. 처치, 상호작용, 사보타지, 임무 완료, 신고, 회의, 투표, 승패는 서버가 검증 후 상태 변경과 이벤트를 전파한다.

위치 입력은 초당 10~20회 보내며 서버는 이동 속도, 허용 위치 변화, 충돌, 현재 게임 상태를 확인한다. 클라이언트는 이전 위치와 대상 위치를 보간해 60 FPS 화면을 만든다. 상태 변경형 맵 오브젝트는 이벤트로만 동기화한다.

## 3. 공용 모델

```ts
type Vector3Data = { x: number; y: number; z: number };
type RoleTeam = "SURVIVOR" | "MAFIA";
type PlayerLifeState = "ALIVE" | "DEAD" | "GHOST";
type GameState = "LOBBY" | "COUNTDOWN" | "ROLE_ASSIGNMENT" | "PLAYING" | "MEETING" | "VOTING" | "RESULT" | "GAME_OVER";
type DoorState = "OPEN" | "CLOSED" | "LOCKED" | "BROKEN" | "DISABLED";
type LightState = "NORMAL" | "LOW" | "EMERGENCY" | "OFF";

type PlayerState = {
  id: string; displayName: string; position: Vector3Data; rotation: number;
  team: RoleTeam; lifeState: PlayerLifeState; inventory: string[];
};
type InteractableState = {
  id: string; type: string; position: Vector3Data; interactionRange: number;
  interactionTime: number; cooldown: number; usableRoles: RoleTeam[];
  currentState: string;
};
```

역할 세부 정보는 본인에게만 보내며, 진영 전체 정보는 같은 마피아에게만 보낸다. 사망자는 유령으로 전환하고 생존자 유령의 남은 개인 임무만 허용한다.

## 4. 방과 게임 상태

방은 최대 25명, 권장 최소 6명이다. 방장은 마피아 수를 설정할 수 있으며 기본 추천은 1~5명 표를 사용한다. 상태는 `LOBBY → COUNTDOWN → ROLE_ASSIGNMENT → PLAYING → MEETING → VOTING → RESULT → PLAYING 또는 GAME_OVER` 순으로 전환한다. 전환은 서버의 유한 상태 기계로 제한한다.

## 5. 상호작용과 맵 시스템

모든 장치는 공통 상호작용 계약을 따른다. 대상 거리, 소요 시간, 쿨타임, 역할 권한, 현재 상태를 서버에서 검사한다. 초기 구현 대상은 문, 발전기, 조명, CCTV, 환풍구, 임무 장치다.

- 문: 일반 개폐와 잠금, 전력 영향 상태를 지원한다.
- 발전기: 조명, CCTV, 문, 통신, 보안 시스템의 전력 공급원이다.
- CCTV: 조작 중 이동을 막고 전력과 통신이 정상일 때만 화면을 제공한다.
- 환풍구: 지정된 연결 그래프를 가진 마피아 전용 이동 경로다.
- 임무: 짧은 일, 긴 일, 공통 일, 협동 일, 긴급 일로 구분한다. 공동 임무 진행도는 서버가 집계한다. 게임 시작 시 확정된 시민 수의 두 배를 완료 목표 건수로 사용해 6명부터 25명까지 시민 한 명당 평균 두 건의 임무량을 유지하며, 한 건의 진행 비중은 `100 ÷ 목표 건수`로 계산한다.

## 6. 핵심 규칙

처치는 마피아 역할, 대상 생존, 허용 거리, 쿨타임, 게임 진행 상태를 모두 통과해야 한다. 시체 신고는 신고 거리에서만 가능하다. 회의가 시작되면 플레이 입력과 일반 상호작용을 멈추고 회의 단계로 전환한다. 투표는 생존자만 한 번 제출할 수 있고, 최다 득표자를 추방하되 동점은 추방하지 않는다.

마피아의 정전은 조명 상태를 낮추고 CCTV 접근을 막는다. 치명적 사보타지는 제한 시간과 복구 조건을 가지며 실패 시 마피아 승리다. 일반 승리는 모든 마피아 추방 또는 공동 임무 완료, 마피아 수가 생존자 수 이상인 경우의 마피아 승리로 판단한다.

## 7. 화면과 품질 목표

생존자 화면에는 임무 목록·진행도·상호작용·신고·아이템을, 마피아 화면에는 처치·사보타지·능력·쿨타임을 표시한다. 권장 60 FPS, 최소 30 FPS, 방당 25명을 목표로 한다. 장치 상태는 가능한 한 이벤트 기반으로 보내며, 모든 서버 입력에 제한과 검증을 둔다.

## 8. 검증 기준

단위 테스트는 상태 전환, 거리와 쿨타임, 투표 동점, 승패 판정을 다룬다. 통합 테스트는 다중 접속과 상태 전파를 확인한다. 웹 화면은 Playwright MCP로 전체 화면 스크린샷을 남긴다.
