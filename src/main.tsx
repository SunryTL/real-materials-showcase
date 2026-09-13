import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import WorkbenchApp from "./workbench/WorkbenchApp";
import PublicWorkbenchApp from "./workbench/PublicWorkbenchApp";
import "./styles.css";
import "./workbench/workbench.css";

const isWorkbench = window.location.pathname.includes("/workbench");
const isPublicWorkbench = isWorkbench && (window.location.hostname.endsWith("github.io") || new URLSearchParams(window.location.search).get("mode") === "public");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isPublicWorkbench ? <PublicWorkbenchApp /> : isWorkbench ? <WorkbenchApp /> : <App />}
  </StrictMode>,
);
