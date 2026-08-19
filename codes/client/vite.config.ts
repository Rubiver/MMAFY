import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/** Vite 개발 서버와 React 변환 설정을 반환한다. */
export default defineConfig({
  plugins: [react()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
