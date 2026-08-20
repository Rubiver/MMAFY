# 로컬 Pi 멀티 에이전트 운영 안내

## 목적

이 문서는 이 저장소를 로컬 `llama-server`, Pi Coding Agent, Qwen 3.8 27B 조합으로 안전하게 개발하기 위한 기준이다. Codex에서 만든 기존 `.agents/skills/`는 그대로 유지하며, Pi용 역할 정의는 `.pi/agents/`에 둔다.

## 저장소 구성

```text
.pi/
  settings.json                         Pi가 이 Git 저장소를 프로젝트 루트로 인식
  agents/
    mafia-scout.md                      읽기 전용 구조 조사
    mafia-planner.md                    읽기 전용 구현 계획
    mafia-implementer.md                단일 작성·검증
    mafia-reviewer.md                   읽기 전용 코드·권한 검토
    mafia-verifier.md                   읽기 전용 테스트 재현
docs/
  LOCAL_PI_MULTI_AGENT.md               이 운영 안내
  templates/
    pi-models.qwen3.8_27b.example.json  개인 Pi 모델 설정 예시
    pi-subagents.config.example.json    개인 Pi 하위 에이전트 설정 예시
```

개인별 포트, 모델 식별자, Pi 전역 설정은 저장소에 강제하지 않는다. 이 방식은 개발자마다 다른 `llama-server` 실행 값과 비밀값을 커밋하지 않기 위함이다.

## 최초 설정

1. `llama-server`가 OpenAI 호환 API를 노출하는지 확인한다. 기본 예시는 `http://127.0.0.1:8080/v1`이지만 실제 주소는 사용 중인 서버에 맞춘다.
2. `GET /v1/models` 응답의 모델 식별자를 확인하고, `docs/templates/pi-models.qwen3.8_27b.example.json`의 `REPLACE_WITH_LLAMA_SERVER_MODEL_ID`와 컨텍스트 길이를 실제 서버 값으로 바꾼다.
3. 완성된 내용을 `~/.pi/agent/models.json`에 기존 제공자 설정과 병합한다. 파일 전체를 덮어쓰지 않는다.
4. 신뢰한 뒤 `pi install npm:pi-subagents`로 하위 에이전트 확장을 설치한다.
5. `docs/templates/pi-subagents.config.example.json`을 `~/.pi/agent/extensions/subagent/config.json`에 기존 설정과 병합한다. Qwen 3.8 27B 단일 서버는 기본적으로 `concurrency: 1`과 `globalConcurrencyLimit: 1`을 유지한다.
6. 저장소 루트에서 Pi를 다시 열고 `/model`에서 `qwen-local` 제공자를 선택한 뒤 `/subagents-doctor`를 실행한다.

`apiKey` 예시 값은 인증 없는 로컬 서버용 자리표시자다. 실제 서버에 인증이 필요하면 개인 환경변수 또는 Pi 인증 설정을 사용하며, 비밀값을 이 저장소에 기록하지 않는다.

## 역할과 흐름

Qwen 3.8 27B 단일 서버는 동시에 여러 자식 에이전트를 실행하면 응답 시간이 크게 늘거나 메모리가 부족해질 수 있다. 따라서 기본 흐름은 병렬 작성이 아니라 순차 인수인계다.

```text
상위 Pi 세션
  ├─ mafia-scout 또는 mafia-planner  읽기 전용 조사·계획
  ├─ mafia-implementer               승인된 범위의 유일한 작성자
  ├─ mafia-reviewer                  읽기 전용 권한·품질 검토
  └─ mafia-verifier                  읽기 전용 테스트 재현
```

- 하나의 작업에서는 `mafia-implementer`만 소스 파일을 수정한다.
- 조사와 계획은 필요한 경우 함께 실행할 수 있지만, 단일 서버에서는 순차 실행이 기본이다.
- 검토에서 문제가 발견되면 같은 구현 담당자에게만 수정 작업을 돌려보내고, 검토와 검증을 다시 수행한다.
- `docs/RULES.md`의 서버 권한, 테스트, 화면 검증, 로그, 커밋 규정이 모든 Pi 역할보다 우선한다.
- 문서에 없는 중요한 게임 설계는 상위 Pi 세션이 사용자에게 확인한다.

## 권장 요청 예시

```text
mafia-scout에게 현재 작업과 관련된 파일 및 서버 권한 위험을 조사하게 해줘.
mafia-planner에게 조사 결과를 바탕으로 수정 파일과 검증 명령이 포함된 계획을 작성하게 해줘.
승인된 계획만 mafia-implementer에게 구현하게 하고, 완료 뒤 mafia-reviewer와 mafia-verifier를 순서대로 실행해줘.
```

## 작업 트리와 커밋

작은 작업은 현재 작업 트리에서 단일 작성자로 진행한다. 서로 독립적인 큰 변경만 `worktree: true`로 분리하고, 결과를 검토한 뒤 상위 세션이 하나씩 통합한다. 기존 미커밋 변경이 있으면 작업 트리를 새로 만들거나 사용자에게 범위를 확인한다. 하위 에이전트는 사용자 기존 변경을 되돌리거나 포함해 커밋하지 않는다.

작업 완료 시에도 이 저장소 규칙대로 관련 변경만 한국어 커밋 메시지로 남긴다. 하위 에이전트의 보고만으로 완료 처리하지 않고, 상위 세션이 테스트·검토 결과와 Git 상태를 확인한다.

## 문제 해결

- 모델이 목록에 없으면 `models.json`의 JSON 형식, `baseUrl`, `api: openai-completions`, 모델 식별자를 확인하고 Pi에서 `/model`을 다시 연다.
- 시스템 지시를 이해하지 못하면 `compat.supportsDeveloperRole: false`를 유지한다. 추론 강도 필드를 거부하면 `supportsReasoningEffort: false`도 유지한다.
- 응답이 멈추거나 너무 느리면 하위 에이전트 병렬 수를 1로 낮추고, `llama-server`의 컨텍스트 길이와 사용 가능한 메모리를 확인한다.
- 확장 상태는 `/subagents-doctor`, 실행 중인 작업은 `/subagents-fleet`로 확인한다.

## 근거 문서

- [Pi 모델 설정 문서](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md): OpenAI 호환 제공자와 호환성 옵션.
- [pi-subagents 안내](https://pi.dev/packages/pi-subagents?type=extension): 설치, 기본 역할, 권장 작업 흐름.
- [pi-subagents 설정 문서](https://github.com/nicobailon/pi-subagents/blob/main/docs/configuration.md): 전역 설정 경로, 동시 실행, 작업 트리 설정.
