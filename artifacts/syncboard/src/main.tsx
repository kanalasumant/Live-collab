import { createRoot } from "react-dom/client";
import { Router as WouterRouter } from "wouter";
import "./index.css";
import App from "./App";

const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

createRoot(document.getElementById("root")!).render(
  <WouterRouter base={base}>
    <App />
  </WouterRouter>
);
