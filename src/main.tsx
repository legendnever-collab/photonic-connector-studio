import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ProjectProvider } from "./project/Store";
import "./styles.css";
import "./visual.css";
import "./surface/workbench.css";
import "./authoring/authoring.css";
import "./authoring/workspace.css";
import "./authoring/workspace3.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProjectProvider><App /></ProjectProvider>
  </React.StrictMode>,
);
