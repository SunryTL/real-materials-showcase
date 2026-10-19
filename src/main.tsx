import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WorkbenchApp from "./workbench/WorkbenchApp";
import PublicWorkbenchApp from "./workbench/PublicWorkbenchApp";
import "./styles.css";
import "./workbench/workbench.css";

const isWorkbench = window.location.pathname.includes("/workbench");
const isPublicWorkbench = isWorkbench && (
  window.location.hostname.endsWith("github.io") ||
  new URLSearchParams(window.location.search).get("mode") === "public"
);

if (isPublicWorkbench) {
  window.history.replaceState(null, "", `${import.meta.env.BASE_URL}${window.location.hash || "#home"}`);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isWorkbench && !isPublicWorkbench ? <WorkbenchApp /> : <PublicWorkbenchApp />}
  </StrictMode>,
);
