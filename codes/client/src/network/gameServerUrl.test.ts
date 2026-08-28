import { describe, expect, it } from "vitest";
import { resolveGameServerUrl } from "./gameServerUrl";

describe("게임 서버 주소 결정", () => {
  it("다른 컴퓨터가 접속할 때 웹 페이지의 호스트 주소를 사용한다", () => {
    expect(resolveGameServerUrl(undefined, { protocol: "http:", hostname: "192.168.0.15" })).toBe("ws://192.168.0.15:2567");
  });

  it("보안 웹 페이지에는 보안 WebSocket을 사용한다", () => {
    expect(resolveGameServerUrl(undefined, { protocol: "https:", hostname: "game.example.com" })).toBe("wss://game.example.com:2567");
  });

  it("명시한 서버 주소와 IPv6 호스트를 올바르게 처리한다", () => {
    expect(resolveGameServerUrl(" ws://server.local:3000 ", { protocol: "http:", hostname: "unused" })).toBe("ws://server.local:3000");
    expect(resolveGameServerUrl(undefined, { protocol: "http:", hostname: "2001:db8::1" })).toBe("ws://[2001:db8::1]:2567");
  });
});
