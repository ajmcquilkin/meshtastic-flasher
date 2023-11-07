import React from "react";
import { Store } from "@tauri-apps/plugin-store";

export const store = new Store(".settings.dat");
export const PersistentStoreContext = React.createContext(store);

export const usePersistentStore = (): Store => {
  const store = React.useContext(PersistentStoreContext);
  return store;
};
