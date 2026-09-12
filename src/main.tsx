import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import WorkbenchApp from "./workbench/WorkbenchApp";
import "./styles.css";
import "./workbench/workbench.css";

const isWorkbench = window.location.pathname.includes("/workbench");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isWorkbench ? <WorkbenchApp /> : <App />}
  </StrictMode>,
);
