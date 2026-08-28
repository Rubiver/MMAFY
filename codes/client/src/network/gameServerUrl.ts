type PageLocation = Pick<Location, "hostname" | "protocol">;

/** 브라우저가 접속한 호스트를 기준으로 기본 게임 서버 WebSocket 주소를 만든다. */
export function resolveGameServerUrl(configuredUrl: string | undefined, pageLocation: PageLocation = window.location): string {
  const explicitUrl = configuredUrl?.trim();
  if (explicitUrl) return explicitUrl;

  const scheme = pageLocation.protocol === "https:" ? "wss" : "ws";
  const hostname = normalizeHostname(pageLocation.hostname || "localhost");
  return `${scheme}://${hostname}:2567`;
}

/** URL에 넣을 IPv6 호스트명에 대괄호를 보장한다. */
function normalizeHostname(hostname: string): string {
  if (hostname.includes(":") && !hostname.startsWith("[")) return `[${hostname}]`;
  return hostname;
}
