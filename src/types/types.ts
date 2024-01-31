import type { Board, FirmwareRelease } from "./backend";

export interface BoardOptionData {
  selectedHwModel: Board["hwModel"] | null;
  selectedPort: string | null;
  selectedFirmwareVersion: FirmwareRelease["id"] | null;
}

export type BoardArchitectureDictionary = Record<string, Board[]>;
export type FirmwareReleaseDictionary = Record<string, FirmwareRelease[]>;
