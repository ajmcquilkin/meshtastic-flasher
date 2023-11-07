import { error } from "@tauri-apps/plugin-log";
import { open } from "@tauri-apps/plugin-shell";

export const openLink = async (link: string) => {
  try {
    await open(link);
  } catch (err) {
    error(`Failed to open bug report URL: ${err}`);
  }
};
