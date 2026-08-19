import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) throw new Error("화면 루트를 찾을 수 없습니다.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
