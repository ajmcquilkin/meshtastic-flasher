import React from "react";
import { Store } from "tauri-plugin-store-api";

export const store = new Store(".settings.dat");
export const PersistentStoreContext = React.createContext(store);

export const usePersistentStore = (): Store => {
  const store = React.useContext(PersistentStoreContext);
  return store;
};
