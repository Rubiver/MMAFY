# 3D 소셜 디덕션 마피아 게임

최대 25명이 한 방에서 즐기는 웹 기반 3D 멀티플레이 소셜 디덕션 게임이다. 생존자는 임무와 협력으로 승리하고, 마피아는 처치와 시설 교란으로 생존자를 고립시킨다. 핵심은 사회적 추리, 환경 상호작용, 멀티플레이 협력의 결합이다.

## 문서 우선순위

작업 전 반드시 [docs/RULES.md](docs/RULES.md)를 읽는다. 제품 목표는 [docs/PRD.md](docs/PRD.md), 기술 설계는 [docs/DETAIL_SPEC.md](docs/DETAIL_SPEC.md), 구현 순서는 `docs/phases/`의 각 문서에서 확인한다.

## 세션 시작 확인

세션을 시작하면 작업 전 `git status`로 기존 미커밋 변경을 확인하고, Playwright MCP 연결 상태를 확인한다. 웹 화면 변경이 있으면 Playwright MCP로 375px·768px·1280px 전체 화면을 검증하고 스크린샷을 `docs/screenshots/`에 저장한다. 검증 뒤에는 MCP 탭과 MCP 전용 Chrome 프로세스만 종료한다.

## 저장소 구조

```text
AGENTS.md                  에이전트용 개요
resume.md                  작업 요약과 다음 작업
docs/
  RULES.md                 필수 작업 규정
  PRD.md                   비개발자용 제품 요구사항
  DETAIL_SPEC.md           개발자용 상세 명세
  current-phase-log.md     시각별 진행 이력
  screenshots/             웹 검증 스크린샷
  phases/                  단계별 구현 계획
codes/                     실제 소스 코드만 두는 위치
```

## 개발 범위

초기 버전은 로비, 최대 25명 방, 3D 이동, 실시간 동기화, 기본 역할, 처치, 시체 신고, 회의와 투표, 기본 임무, 문·발전기·조명·CCTV·환풍구, 정전 교란과 승패까지다. 복잡한 직업, 음성 채팅, 친구와 경쟁 시스템은 후순위다.

## 기술 방향

클라이언트는 TypeScript, React, Vite, Three.js, React Three Fiber, Drei, Rapier, Zustand를 쓴다. 서버는 Node.js와 TypeScript 기반이며 Colyseus 또는 동등한 권한형 WebSocket 구조를 쓴다. 게임 결과 판정은 항상 서버가 맡는다. 공용 타입과 프로토콜은 `codes/shared/`에 둔다.

## 작업 원칙

- 실제 코드는 항상 `codes/` 안에만 작성한다.
- 클라이언트 입력은 신뢰하지 않고 서버가 거리, 권한, 상태, 쿨타임을 검증한다.
- 화면이 바뀌는 웹 작업은 Playwright MCP로 전체 화면을 촬영해 검증한다.
- 각 단계 종료 시 체크리스트, 로그, `resume.md`를 갱신하고 한국어 커밋을 남긴다.
- 개선 또는 수정 완료 때마다 관련 변경만 즉시 한국어 커밋으로 남기며, 작업 시작 전 `git status`로 미커밋 변경을 확인한다. 세부 절차는 `docs/RULES.md`를 따른다.
- 모호하거나 설계에 큰 영향을 주는 사항은 추정하지 말고 사용자에게 확인한다.

## 로컬 Pi Coding Agent 테스트와 검증

- Codex는 개발 과정에서 독립 테스트·검증, 코드 검토, 자료 조사가 필요하다고 판단하면 사용자 요청 없이 실제 Pi Coding Agent를 실행할 수 있다. Codex 하위 에이전트에 Pi 역할을 부여해 대체하지 않는다.
- WSL Pi 실행 파일은 `/home/ssafy/.nvm/versions/node/v24.18.0/bin/pi`이고, 로컬 모델은 `qwen3.8-27b`다.
- Pi는 코드 검토, 테스트·빌드 결과 검증, 저장소·공식 문서 기반 자료 조사만 담당한다. 작은 변경은 Codex가 자체 검증하고, 다음 경우에는 Pi의 독립 검토를 우선 사용한다: 서버 권한·보안 경로 변경, 테스트 실패 원인 분석, 큰 리팩터링, 배포 전 검토, 설계 결정의 교차 검증.

  ```bash
  /home/ssafy/.nvm/versions/node/v24.18.0/bin/pi -p \
    --model qwen3.8-27b \
    --tools read,grep,find,ls,bash \
    "<테스트 또는 검증 요청>"
  ```

- Pi에는 읽기, 검색, 목록 확인과 테스트·빌드 명령 실행만 허용한다. 코드·문서 수정, 패키지 설치, 개발 서버 실행, Git 추가·커밋·되돌리기는 사용자에게 별도 승인을 받은 경우에만 맡긴다.
- Pi 실행 전 Codex는 요청 범위와 읽기 전용 도구 목록을 프롬프트에 명시한다. Pi 결과는 근거 자료이며, 최종 구현·판단·커밋 책임은 Codex가 진다.
- Pi가 테스트를 실행할 때는 WSL NVM 환경을 사용한다. Node.js 명령 전 `source /home/ssafy/.nvm/nvm.sh`를 실행하고, 프로젝트 `codes/`에서 `npm test`와 `npm run build`를 우선 사용한다.
- Pi 실행 시 로컬 `llama-server`와 GPU 사용량이 증가하는 것이 정상이다. 실패하면 실행 명령과 오류를 보고하고, Codex 하위 에이전트 결과로 대체하지 않는다.
- 상세 운영 방법은 `docs/LOCAL_PI_MULTI_AGENT.md`를 따른다.
