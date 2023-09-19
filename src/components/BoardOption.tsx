import * as Select from "@radix-ui/react-select";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@radix-ui/react-icons";
import {
  ShieldAlert,
  ShieldCheck,
  Copy,
  Trash2,
  Check,
  X,
  Loader,
} from "lucide-react";
import { open } from "@tauri-apps/api/dialog";

import {
  Board,
  FirmwareRelease,
  ListBoardsResponse,
  ListFirmwareResponse,
  SerialPortInfo,
} from "../types";
import DefaultTooltip from "./generic/DefaultTooltip";

export interface BoardOptionData {
  hwModel: Board["hwModel"];
  port: string;
  firmwareVersion: FirmwareRelease["id"];
}

export interface BoardOptionProps {
  board: BoardOptionData;
  activelySupported: boolean;
  requestState: "pending" | "success" | "error" | null;

  availableBoards: ListBoardsResponse;
  availableFirmwareVersions: ListFirmwareResponse["releases"];
  availableSerialPorts: SerialPortInfo[];

  setHwModel: (hwModel: Board["hwModel"]) => void;
  setPort: (port: string) => void;
  setFirmwareVersion: (version: FirmwareRelease["id"]) => void;

  duplicateSelf: () => void;
  deleteSelf: () => void;
}

const BoardOption = ({
  board,
  activelySupported,
  requestState,

  availableBoards,
  availableFirmwareVersions,
  availableSerialPorts,

  setHwModel,
  setPort,
  setFirmwareVersion,

  duplicateSelf,
  deleteSelf,
}: BoardOptionProps) => {
  const boards = availableBoards.reduce(
    (acc, board) => {
      if (board.architecture.includes("esp")) {
        return {
          ...acc,
          esp: [...acc.esp, board],
        };
      }

      if (board.architecture.includes("nrf")) {
        return {
          ...acc,
          nrf: [...acc.nrf, board],
        };
      }

      return {
        ...acc,
        other: [...acc.other, board],
      };
    },
    {
      esp: [] as Board[],
      nrf: [] as Board[],
      other: [] as Board[],
    }
  );

  const handlePortClick = async () => {
    const result = await open({
      multiple: false,
      directory: true,
    });

    setPort(result as string); // Not allowing multiple
  };

  return (
    <div className="flex flex-row justify-between px-4 py-3 border border-gray-100 shadow-md rounded-lg">
      <div className="flex flex-row justify-start gap-4">
        <div>
          {activelySupported ? (
            <DefaultTooltip text="This board is actively supported!">
              <ShieldCheck className="text-gray-300" strokeWidth={1.5} />
            </DefaultTooltip>
          ) : (
            <DefaultTooltip text="This board is no longer actively supported by the Meshtastic project. Consider choosing an alternative board.">
              <ShieldAlert className="text-red-400" strokeWidth={1.5} />
            </DefaultTooltip>
          )}
        </div>

        <Select.Root
          value={`${board.hwModel}`}
          onValueChange={(board) => setHwModel(parseInt(board))}
        >
          <Select.Trigger className="flex flex-row gap-2" aria-label="Food">
            <Select.Value placeholder="Device" />
            <Select.Icon className="my-auto">
              <ChevronDownIcon />
            </Select.Icon>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content className="bg-white p-3 rounded-lg text-base font-normal text-gray-700 border border-gray-200 disabled:text-gray-400 disabled:bg-gray-100 shadow-lg">
              <Select.ScrollUpButton className="mx-auto">
                <ChevronUpIcon />
              </Select.ScrollUpButton>

              <Select.Viewport className="">
                <Select.Group>
                  <Select.Label className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                    ESP
                  </Select.Label>

                  {boards.esp.map((board) => (
                    <Select.Item
                      className="flex flex-row gap-2 px-2 py-1 rounded-md hover:bg-gray-200 select-none cursor-pointer"
                      value={`${board.hwModel}`}
                    >
                      <Select.ItemText>{board.hwModelSlug}</Select.ItemText>
                      <Select.ItemIndicator className="ml-auto my-auto">
                        <CheckIcon />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Group>

                <Select.Separator className="mx-1 my-3 h-px bg-gray-300" />

                <Select.Group>
                  <Select.Label className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                    NRF
                  </Select.Label>

                  {boards.nrf.map((board) => (
                    <Select.Item
                      className="flex flex-row gap-2 px-2 py-1 rounded-md hover:bg-gray-200 select-none cursor-pointer"
                      value={`${board.hwModel}`}
                    >
                      <Select.ItemText>{board.hwModelSlug}</Select.ItemText>
                      <Select.ItemIndicator className="ml-auto my-auto">
                        <CheckIcon />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Group>

                <Select.Separator className="mx-1 my-3 h-px bg-gray-300" />

                <Select.Group>
                  <Select.Label className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                    Other
                  </Select.Label>

                  {boards.other.map((board) => (
                    <Select.Item
                      className="flex flex-row gap-2 px-2 py-1 rounded-md hover:bg-gray-200 select-none cursor-pointer"
                      value={`${board.hwModel}`}
                    >
                      <Select.ItemText>{board.hwModelSlug}</Select.ItemText>
                      <Select.ItemIndicator className="ml-auto my-auto">
                        <CheckIcon />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Viewport>

              <Select.ScrollDownButton className="mx-auto">
                <ChevronDownIcon />
              </Select.ScrollDownButton>
            </Select.Content>
          </Select.Portal>
        </Select.Root>

        {availableBoards
          .find((b) => b.hwModel === board.hwModel)
          ?.architecture.includes("esp") ? (
          <Select.Root
            value={`${board.port}`}
            onValueChange={(port) => setPort(port)}
          >
            <Select.Trigger className="flex flex-row gap-2" aria-label="Food">
              <Select.Value placeholder="Serial Port" />
              <Select.Icon className="my-auto">
                <ChevronDownIcon />
              </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
              <Select.Content className="bg-white p-3 rounded-lg text-base font-normal text-gray-700 border border-gray-200 disabled:text-gray-400 disabled:bg-gray-100 shadow-lg">
                <Select.ScrollUpButton className="mx-auto">
                  <ChevronUpIcon />
                </Select.ScrollUpButton>

                <Select.Viewport className="">
                  <Select.Group>
                    <Select.Label className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                      Serial Ports
                    </Select.Label>

                    {availableSerialPorts.map((port) => (
                      <Select.Item
                        className="flex flex-row gap-2 px-2 py-1 rounded-md hover:bg-gray-200 select-none cursor-pointer"
                        value={port.port_name}
                      >
                        <Select.ItemText>{port.port_name}</Select.ItemText>
                        <Select.ItemIndicator className="my-auto">
                          <CheckIcon />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Group>
                </Select.Viewport>

                <Select.ScrollDownButton className="mx-auto">
                  <ChevronDownIcon />
                </Select.ScrollDownButton>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        ) : (
          <button type="button" onClick={handlePortClick}>
            <DefaultTooltip text="Select Port">
              <p>{board.port || "Select Port"}</p>
            </DefaultTooltip>
          </button>
        )}

        <Select.Root
          value={`${board.firmwareVersion}`}
          onValueChange={(version) => setFirmwareVersion(version)}
        >
          <Select.Trigger className="flex flex-row gap-2" aria-label="Food">
            <Select.Value placeholder="Firmware Version" />
            <Select.Icon className="my-auto">
              <ChevronDownIcon />
            </Select.Icon>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content className="bg-white p-3 rounded-lg text-base font-normal text-gray-700 border border-gray-200 disabled:text-gray-400 disabled:bg-gray-100 shadow-lg">
              <Select.ScrollUpButton className="mx-auto">
                <ChevronUpIcon />
              </Select.ScrollUpButton>

              <Select.Viewport className="">
                <Select.Group>
                  <Select.Label className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                    Stable
                  </Select.Label>

                  {availableFirmwareVersions.stable.map((version) => (
                    <Select.Item
                      key={version.id}
                      className="flex flex-row gap-2 px-2 py-1 rounded-md hover:bg-gray-200 select-none cursor-pointer"
                      value={version.id}
                    >
                      <Select.ItemText>{version.id}</Select.ItemText>
                      <Select.ItemIndicator className="my-auto">
                        <CheckIcon />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Group>

                <Select.Separator className="mx-1 my-3 h-px bg-gray-300" />

                <Select.Group>
                  <Select.Label className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                    Alpha
                  </Select.Label>

                  {availableFirmwareVersions.alpha.map((version) => (
                    <Select.Item
                      key={version.id}
                      className="flex flex-row gap-2 px-2 py-1 rounded-md hover:bg-gray-200 select-none cursor-pointer"
                      value={version.id}
                    >
                      <Select.ItemText>{version.id}</Select.ItemText>
                      <Select.ItemIndicator className="my-auto">
                        <CheckIcon />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Viewport>

              <Select.ScrollDownButton className="mx-auto">
                <ChevronDownIcon />
              </Select.ScrollDownButton>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      <div className="flex flex-row justify-end gap-4">
        <div>
          {requestState === "pending" ? (
            <DefaultTooltip text="Flashing device...">
              <Loader
                className="animate-spin text-gray-400"
                strokeWidth={1.5}
              />
            </DefaultTooltip>
          ) : requestState === "success" ? (
            <DefaultTooltip text="Device flashed successfully">
              <Check className="text-green-500" strokeWidth={1.5} />
            </DefaultTooltip>
          ) : requestState === "error" ? (
            <DefaultTooltip text="Failed to flash device">
              <X className="text-red-500" strokeWidth={1.5} />
            </DefaultTooltip>
          ) : null}
        </div>

        <button type="button" onClick={duplicateSelf}>
          <DefaultTooltip text="Duplicate Board Option">
            <Copy className="text-gray-400" strokeWidth={1.5} />
          </DefaultTooltip>
        </button>

        <button type="button" onClick={deleteSelf}>
          <DefaultTooltip text="Delete Board Option">
            <Trash2 className="text-gray-400" strokeWidth={1.5} />
          </DefaultTooltip>
        </button>
      </div>
    </div>
  );
};

export default BoardOption;
