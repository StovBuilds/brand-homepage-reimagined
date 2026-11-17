import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Concept from "./Concept";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Concept />
  </StrictMode>,
);
