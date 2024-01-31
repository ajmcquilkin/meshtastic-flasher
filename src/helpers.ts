import { error } from "tauri-plugin-log-api";
import { open } from "@tauri-apps/api/shell";

export const openLink = async (link: string) => {
  try {
    await open(link);
  } catch (err) {
    error(`Failed to open bug report URL: ${err}`);
  }
};
