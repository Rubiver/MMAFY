---
date: 2026-08-25 17:30:40
tags: [phase-5, bundle-size, webgl, performance]
category: improvement
---

- 문제: 생산 빌드의 초기 JavaScript 묶음이 압축 전 약 3.51MB라 첫 접속이 느려질 수 있다.
- 원인 분석: 3D 월드 지연 불러오기는 개발 모드의 React StrictMode 재마운트와 겹쳐 WebGL 컨텍스트가 손실되고 화면이 검게 멈추는 출시 차단 오류를 만들었다. 화면 안정성을 위해 즉시 불러오기로 되돌렸다.
- 영향 범위: 현재 화면은 정상이나 저속 네트워크의 첫 다운로드 시간이 길 수 있다.
- 개선 제안: 출시 뒤 React Three Fiber 캔버스의 단일 마운트를 보장하는 경계에서 청크를 나누고, WebGL 컨텍스트 유지 E2E 검증을 함께 추가한다.
