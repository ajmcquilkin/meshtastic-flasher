import React from "react";
import ReactDOM from "react-dom/client";
import { info, attachConsole } from "@tauri-apps/plugin-log";

import App from "./App";
import { PersistentStoreContext, store } from "./persistence";

import "./styles.css";

attachConsole()
  .then(() => {
    info("Console logger attached");
  })
  .catch((err) => {
    console.error("Failed to attach console logger", err);
  });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PersistentStoreContext.Provider value={store}>
      <App />
    </PersistentStoreContext.Provider>
  </React.StrictMode>
);
