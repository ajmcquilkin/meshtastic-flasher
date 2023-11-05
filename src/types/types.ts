import { Board, FirmwareRelease } from "./backend";

export interface BoardOptionData {
  selectedHwModel: Board["hwModel"] | null;
  selectedPort: string | null;
  selectedFirmwareVersion: FirmwareRelease["id"] | null;
}
