import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { AuthProvider } from "./context/AuthContext.js";
import { ShellProvider } from "./context/ShellContext.js";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ShellProvider>
          <App />
        </ShellProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
