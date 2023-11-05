import * as Select from "@radix-ui/react-select";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { Copy, Trash2, Check, X, Loader, GripVertical } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import groupBy from "lodash.groupby";
import orderBy from "lodash.orderby";

import { BoardOptionData } from "../types/types";
import {
  Board,
  FirmwareRelease,
  ListBoardsResponse,
  ListFirmwareResponse,
  SerialPortInfo,
} from "../types/backend";
import DefaultTooltip from "./generic/DefaultTooltip";
import { useEffect, useState } from "react";
import ProgressBar from "./ProgressBar";
import { info } from "@tauri-apps/plugin-log";

export interface BoardOptionProps {
  boardOptionData: BoardOptionData;
  selectedBoard: Board | null;
  requestState: "pending" | "success" | "error" | null;

  availableBoards: ListBoardsResponse;
  availableFirmwareVersions: ListFirmwareResponse["releases"];
  availableSerialPorts: SerialPortInfo[];

  setHwModel: (hwModel: Board["hwModel"]) => void;
  setSerialPort: (port: string) => void;
  setFirmwareVersion: (version: FirmwareRelease["id"]) => void;

  duplicateSelf: () => void;
  deleteSelf: () => void;
}

const BoardOption = ({
  boardOptionData,
  requestState,
  selectedBoard,

  availableBoards,
  availableSerialPorts,
  availableFirmwareVersions,

  setHwModel,
  setSerialPort,
  setFirmwareVersion,

  duplicateSelf,
  deleteSelf,
}: BoardOptionProps) => {
  const [progress, setProgress] = useState<number>(0);

  // Sort first by supported then by alphabetical
  const groupedBoards = groupBy(
    orderBy(
      availableBoards,
      [(board) => board.activelySupported, (board) => board.displayName],
      ["desc", "asc"]
    ),
    (board) => board.architecture
  );

  // Workaround to allow for async cleanup functions
  useEffect(() => {
    let cleanupFn: (() => void) | null = null;

    // Define the async function inside the useEffect
    async function setupListener() {
      const unlisten = await listen<{
        boardId: string;
        current: number;
        total: number;
      }>(`flash-status-update-${boardOptionData.selectedPort}`, (event) => {
        const { boardId, current, total } = event.payload;
        info(`Received event from "${boardId}": ${JSON.stringify(event)}`);
        setProgress((current / total) * 100);
      });

      cleanupFn = unlisten;
    }

    // Execute the async function
    setupListener();

    // Return the cleanup function
    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, []);

  const handlePortClick = async () => {
    const result = await open({
      multiple: false,
      directory: true,
    });

    setSerialPort(result as string); // Not allowing multiple dirs, can ignore string[]
  };

  return (
    <div className="flex flex-row justify-between px-4 py-3 border border-gray-100 shadow-md rounded-lg">
      <div className="flex flex-row justify-start gap-4">
        <DefaultTooltip text="Drag to reorder not yet implemented">
          <GripVertical className="cursor-pointer text-gray-300" />
        </DefaultTooltip>

        <Select.Root
          value={`${boardOptionData.selectedHwModel}`}
          onValueChange={(board) => setHwModel(parseInt(board))}
        >
          <Select.Trigger
            className="flex flex-row gap-2 text-gray-500"
            aria-label="Devices"
          >
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
                {Object.entries(groupedBoards)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([architecture, boards], index) => {
                    console.log(architecture, boards);
                    return (
                      <>
                        <Select.Group>
                          <Select.Label className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                            {architecture.toLocaleUpperCase()}
                          </Select.Label>

                          {boards.map((board) => (
                            <Select.Item
                              className={`flex flex-row gap-2 px-2 py-1 rounded-md hover:bg-gray-200 select-none cursor-pointer ${
                                board.activelySupported
                                  ? "text-gray-500"
                                  : "text-gray-400"
                              }`}
                              value={`${board.hwModel}`}
                            >
                              {board.activelySupported ? null : (
                                <DefaultTooltip text="This board is no longer actively supported by the Meshtastic project. Consider choosing an alternative board.">
                                  <ExclamationTriangleIcon className="my-auto text-yellow-500" />
                                </DefaultTooltip>
                              )}
                              <Select.ItemText>
                                {board.displayName}
                              </Select.ItemText>
                              <Select.ItemIndicator className="ml-auto my-auto text-gray-700">
                                <CheckIcon />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Group>

                        {index !== Object.keys(groupedBoards).length - 1 ? (
                          <Select.Separator className="mx-1 my-3 h-px bg-gray-300" />
                        ) : null}
                      </>
                    );
                  })}
              </Select.Viewport>

              <Select.ScrollDownButton className="mx-auto">
                <ChevronDownIcon />
              </Select.ScrollDownButton>
            </Select.Content>
          </Select.Portal>
        </Select.Root>

        {selectedBoard?.architecture.includes("esp") ? (
          <Select.Root
            value={`${boardOptionData.selectedPort}`}
            onValueChange={(port) => setSerialPort(port)}
          >
            <Select.Trigger
              className="flex flex-row gap-2 text-gray-500"
              aria-label="Serial ports"
            >
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
                        <Select.ItemText className="text-gray-500">
                          {port.port_name}
                        </Select.ItemText>
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
              <p className="text-gray-500">
                {boardOptionData.selectedPort || "Select Port"}
              </p>
            </DefaultTooltip>
          </button>
        )}

        <Select.Root
          value={`${boardOptionData.selectedFirmwareVersion}`}
          onValueChange={(version) => setFirmwareVersion(version)}
        >
          <Select.Trigger
            className="flex flex-row gap-2 text-gray-500"
            aria-label="Firmware versions"
          >
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
                      <Select.ItemText className="text-gray-500">
                        {version.id}
                      </Select.ItemText>
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
                      <Select.ItemText className="text-gray-500">
                        {version.id}
                      </Select.ItemText>
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
              {selectedBoard?.architecture.includes("esp") ? (
                <div className="flex flex-col h-full">
                  <ProgressBar
                    className="my-auto w-24"
                    progressPercentage={progress}
                  />
                </div>
              ) : (
                <Loader
                  className="animate-spin text-gray-400"
                  strokeWidth={1.5}
                />
              )}
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
          <DefaultTooltip text="Duplicate configuration">
            <Copy className="text-gray-400" strokeWidth={1.5} />
          </DefaultTooltip>
        </button>

        <button type="button" onClick={deleteSelf}>
          <DefaultTooltip text="Delete configuration">
            <Trash2 className="text-gray-400" strokeWidth={1.5} />
          </DefaultTooltip>
        </button>
      </div>
    </div>
  );
};

export default BoardOption;
