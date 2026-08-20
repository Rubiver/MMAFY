---
name: harness-compounder
description: phase 실행 결과를 분석하여 문제점과 반복 패턴을 기록하고, 개선 제안을 도출하는 분석 및 기록 스킬
---

## 사용 시기

- 각 phase 실행 완료 후
- phase 재시도 발생 시
- phase 검증 결과 분석이 필요할 때
- 다음 phase를 위한 개선 사항 도출이 필요할 때

## 기능

1. **실행 결과 분석**: 현재 phase의 실행 결과(성공/실패/재시도 이력)를 분석
2. **문제점 누적 기록**: 자주 발생하는 문제점이나 반복 패턴을 `./docs/unsolved-compound-log.md`에 기록
3. **재시도 패턴 기록**: 재시도가 자주 이루어지는 부분을 반드시 기록
4. **개선 문제 관리**: 개선된 문제는 `./docs/solved-compound-log.md`에서 별도로 관리
5. **개선 제안 도출**: 분석 결과를 바탕으로 다음 phase를 위한 개선 제안 제공
6. **원인 분석**: 단순히 실패한 것이 아니라, 왜 실패했는지 정확히 파악
7. **즉시 개선 및 이관**: 이 단계에서 즉시 개선 가능한 문제는 개선 후 solved로 이관. 이후 phase에서 개선할 문제는 사용자에게 알림

## 기록 형식

모든 로그는 다음 형식을 따른다:

```markdown
---
date: YYYY-MM-DD HH:mm:ss
tags: [tag1, tag2, tag3]
category: problem | repeated-pattern | improvement
---

- 문제/패턴 설명
- 원인 분석
- 영향 범위
- 개선 제안 (해당 시)
```

### solved-compound-log.md 특수 사항

- `category`는 `solved`로 고정
- `resolved-date` 필드 추가 (해결한 일시 기록)

```markdown
---
date: YYYY-MM-DD HH:mm:ss
resolved-date: YYYY-MM-DD HH:mm:ss
tags: [tag1, tag2, tag3]
category: solved
---

- 원래 문제 설명
- 해결 방법
- 해결 일자
```

## 실행 절차

### 1. 분석 준비

- 현재 phase의 실행 이력 확인
- 재시도 기록 분석
- 관련 로그 파일 확인 (`./docs/current-phase-log.md` 등)

### 2. 문제 분류

- **problem**: 단일 문제점 (원인과 영향 파악 필요)
- **repeated-pattern**: 반복적으로 발생하는 패턴
- **improvement**: 개선 기회 (아직 문제화되지는 않았으나 예방 차원)

### 3. 즉시 개선 가능 여부 판단

- **즉시 개선 가능**: 현재 session에서 수정 가능한 경우 → 직접 개선 → solved로 이관
- **후속 phase 개선 필요**: 다음 phase에서 다뤄야 하는 경우 → unsolved에 기록 → 사용자에게 알림

### 4. 로그 기록

- 분석 결과를 위 형식에 따라 `unsolved-compound-log.md` 또는 `solved-compound-log.md`에 기록
- 파일이 없으면 생성

### 5. solved 이관 처리

- `unsolved-compound-log.md`에서 `solved-compound-log.md`로 이관할 경우:
  - unsolved에서 해당 항목을 **완전히 삭제**
  - solved에 resolved-date 포함하여 추가

### 6. 개선 제안

- 다음 phase를 위한 구체적인 개선 제안 도출
- 사용자에게 명확히 보고

## 규칙

1. **한국어 작성**: 모든 내용은 한국어로 작성 (기술 용어는 영문 유지 가능)
2. **중국어 금지**: 중국어 한자 절대 사용 금지
3. **원인 분석 필수**: 단순히 "실패함"이 아니라 "왜 실패했는지" 기록
4. **재시도 기록 의무화**: 재시도가 발생한 경우 반드시 기록
5. **이관 시 완전 삭제**: solved로 이관 시 unsolved에서 해당 항목 완전 삭제
6. **사용자 알림**: 후속 phase 개선 사항은 반드시 사용자에게 알림
7. **태그 체계**: 관련성을 높이기 위해 적절한 tags 사용

## phase 완료 처리

이 스킬은 phase workflow 의 마지막 스킬이므로, 분석 및 기록 완료 후 다음 절차를 실행한다:

### 1. 체크박스 완료 기록

- 현재 phase 파일(`docs/phases/phase-N.md`)의 `## 완료 체크리스트` 섹션에서 모든 체크박스를 완료 상태로 변경
- 변경 전: `- [ ] ...`
- 변경 후: `- [x] ...`
- phase 파일 경식이 불분할 경우, `docs/phases//` 디렉토리에서 해당 phase 번호의 파일 탐색

### 2. git commit

- 완료된 체크박스 변경 및 기록된 로그 파일을 staging
- commit 메시지 예시: `chore: phase-N 완료 - harness-compounder 분석 및 기록`
- commit 후 push는 하지 않고, 사용자에게 push 여부 확인 요청

### 3. resume.md 갱신

- 프로젝트 루트의 `./resume.md` 를 갱신한다
- `resume.md` 는 세션이 종료될때를 대비하여 지금까지 어떤 작업을 했는지를 간략히 명시하고, 다음 phase 가 무엇인지 명시하는 역할을 한다
- 갱신 절차:
  1. 기존 `resume.md` 가 있으면 읽어서 기존 내용 유지
  2. `### 작업 내용` 섹션에 현재 phase 의 실행 결과 요약 추가 (성공/실패/재시도 이력 포함)
  3. `### 다음 작업` 섹션에 다음 phase 의 번호와 제목 명시
  4. 파일이 없으면 새로 생성 — 최소 형식:

     ```markdown
     # 작업 요약

     ## 프로젝트: [프로젝트명]

     ### 생성 일시
     [생성 일시]

     ### 작업 내용
     [지금까지의 작업 요약]

     ### 다음 작업
     [다음 phase 번호와 제목]
     ```

## 참고

- 이 스킬은 다른 스킬(phase-executor, phase-verifier 등)과 협력하여 작동
- phase 실행 후 자동으로 호출되거나, 수동으로 분석을 요청할 때 사용
- 누적된 로그는 프로젝트 전체의 품질 개선에 기여