---
date: 2026-08-19 13:46:42
tags: [phase-1, bundle-size, performance]
category: improvement
---

- 문제: 생산 빌드의 초기 JavaScript 번들이 압축 전 약 3.3MB로 권고 크기를 넘는다.
- 원인 분석: Three.js와 React Three Fiber 관련 의존성을 초기 화면에서 한 번에 불러온다.
- 영향 범위: 초기 접속 환경에서 내려받기와 화면 시작 시간이 길어질 수 있다.
- 개선 제안: 멀티플레이 화면과 3D 맵이 분리되는 시점에 동적 불러오기 또는 Rollup 청크 분할을 검토한다.
