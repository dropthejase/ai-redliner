import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import "./styles.css";

/* global document, Office, module, require */

Office.onReady(() => {
  const rootElement = document.getElementById("container");
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
  }
});
