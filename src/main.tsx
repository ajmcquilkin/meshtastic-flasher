import React from "react";
import ReactDOM from "react-dom/client";
import { ask, message } from "@tauri-apps/api/dialog";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import { relaunch } from "@tauri-apps/api/process";
import { info, error, attachConsole } from "tauri-plugin-log-api";

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

const asyncHelper = async () => {
  try {
    const { shouldUpdate, manifest } = await checkUpdate();

    if (!manifest?.version) {
      error("Failed to fetch manifest version");
      return;
    }

    if (!shouldUpdate) {
      info("Tauri indicated that no update is available, not updating...");
      return;
    }

    const userAcceptedUpdate = await ask(
      `There is an update available from ${APP_VERSION} to ${manifest.version}. Would you like to install it?`,
      { title: `Update Available for ${manifest.version}` }
    );

    if (!userAcceptedUpdate) {
      info("User declined update, not updating...");
      return;
    }

    info(
      `Installing update ${manifest?.version}, ${manifest?.date}, ${manifest?.body}`
    );

    // Install the update. This will also restart the app on Windows!
    await installUpdate();

    info("Update installed, relaunching app...");

    // On macOS and Linux you will need to restart the app manually.
    // You could use this step to display another confirmation dialog.
    await relaunch();

    info("App relaunched successfully");

    await message(`Update to ${manifest.version} installed successfully!`);
  } catch (err) {
    error(`Failed to install update: ${err}`);
  }
};

asyncHelper();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PersistentStoreContext.Provider value={store}>
      <App />
    </PersistentStoreContext.Provider>
  </React.StrictMode>
);
