// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element missing from index.html");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
