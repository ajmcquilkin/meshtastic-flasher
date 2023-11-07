import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpFromLine, Loader, Plus } from "lucide-react";
import { info, error } from "@tauri-apps/plugin-log";
import groupBy from "lodash.groupby";
import orderBy from "lodash.orderby";

import {
  Board,
  ListBoardsResponse,
  ListFirmwareResponse,
  SerialPortInfo,
} from "./types/backend";
import BoardOption from "./components/BoardOption";
import Titlebar from "./components/Titlebar";
import DefaultTooltip from "./components/generic/DefaultTooltip";
import { useAppReducer } from "./state/reducer";
import {
  createAddBoardAction,
  createDeleteBoardAction,
  createDuplicateBoardAction,
  createSetBoardHwModelAction,
  createSetBoardPortAction,
  createSetBoardVersionAction,
} from "./state/actions";
import WelcomeScreen from "./components/WelcomeScreenDialog";
import {
  BoardArchitectureDictionary,
  BoardOptionData,
  FirmwareReleaseDictionary,
} from "./types/types";
import { usePersistentStore } from "./persistence";

const getFirstBoard = (
  availableBoards: BoardArchitectureDictionary
): Board | null => {
  const firstArchitecture = Object.keys(availableBoards)?.[0];
  return availableBoards?.[firstArchitecture]?.[0] ?? null;
};

const findBoardByHwModel = (
  availableBoards: BoardArchitectureDictionary,
  hwModel: number | null
): Board | null => {
  if (!hwModel) {
    return null;
  }

  const board = Object.values(availableBoards)
    .flat()
    .find((b) => b.hwModel === hwModel);

  return board ?? null;
};

const App = () => {
  const [availableBoards, setAvailableBoards] =
    useState<BoardArchitectureDictionary | null>(null);
  const [availableSerialPorts, setAvailableSerialPorts] = useState<
    SerialPortInfo[] | null
  >(null);
  const [availableFirmwareVersions, setAvailableFirmwareVersions] =
    useState<FirmwareReleaseDictionary | null>(null);

  const [flashStates, setFlashStates] = useState<{
    [port: string]: "pending" | "success" | "error" | null;
  }>({});

  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);

  const [state, dispatch] = useAppReducer();
  const persistentStore = usePersistentStore();

  const handleUpdateShowWelcomeScreen = async (
    shouldShowWelcomeScreen: boolean
  ) => {
    await persistentStore.set("hasSeenWelcomeScreen", !shouldShowWelcomeScreen);
    info(`Setting 'hasSeenWelcomeScreen' to ${!shouldShowWelcomeScreen}`);
    setShowWelcomeScreen(shouldShowWelcomeScreen);
  };

  useEffect(() => {
    const handleCreateStore = async () => {
      const hasSeenWelcomeScreen = await persistentStore.get(
        "hasSeenWelcomeScreen"
      );

      if (!hasSeenWelcomeScreen) {
        await handleUpdateShowWelcomeScreen(true);
        info("Persisting that user has seen welcome screen");
        await persistentStore.set("hasSeenWelcomeScreen", true);
      } else {
        info("User has already seen welcome screen");
      }
    };

    handleCreateStore();
  }, []);

  const getBoards = async () => {
    const receivedBoards = (await invoke(
      "fetch_supported_boards"
    )) as ListBoardsResponse;
    info(`Received ${receivedBoards.length} boards from backend`);

    const groupedBoards = groupBy(
      orderBy(
        receivedBoards,
        [(board) => board.activelySupported, (board) => board.displayName],
        ["desc", "asc"]
      ),
      (board) => board.architecture
    );

    setAvailableBoards(groupedBoards);
  };

  const getFirmwareReleases = async () => {
    const releasesResponse = (await invoke(
      "fetch_firmware_releases"
    )) as ListFirmwareResponse;
    info(
      `Received ${releasesResponse.releases.alpha?.length} alpha and ${releasesResponse.releases.stable?.length} stable firmware releases from backend`
    );
    setAvailableFirmwareVersions(releasesResponse.releases);
  };

  const getAvailableSerialPorts = async () => {
    const ports = (await invoke(
      "get_available_serial_ports"
    )) as SerialPortInfo[];
    info(`Received ${ports.length} serial ports from backend`);
    setAvailableSerialPorts(ports);
  };

  useEffect(() => {
    getBoards();
    getFirmwareReleases();
    getAvailableSerialPorts();
  }, []);

  const flashDevice = async (port: string, board: BoardOptionData) => {
    try {
      setFlashStates((prev) => ({ ...prev, [port]: "pending" }));

      await invoke("flash_device", {
        hwModel: board.selectedHwModel,
        uploadPort: board.selectedPort,
        firmwareVersionId: board.selectedFirmwareVersion,
      });

      setFlashStates((prev) => ({ ...prev, [port]: "success" }));
    } catch (err) {
      error(err as string);
      setFlashStates((prev) => ({ ...prev, [port]: "error" }));
    }
  };

  const handleFlashDevices = async () => {
    info('Clicked "Flash devices"');

    Promise.all(
      state.boards.map((b) => b.selectedPort && flashDevice(b.selectedPort, b))
    )
      .then(() => info("Flashing completed"))
      .catch((e) => error("Flashing failed", e));
  };

  return (
    <Dialog.Root
      open={showWelcomeScreen}
      onOpenChange={(show) => handleUpdateShowWelcomeScreen(show)}
    >
      <div className="relative w-full min-h-screen bg-white">
        <Titlebar
          showWelcomeScreen={() => handleUpdateShowWelcomeScreen(true)}
          refreshSerialPorts={() => getAvailableSerialPorts()}
        />

        <WelcomeScreen />

        <div className="absolute bottom-9 right-9">
          <DefaultTooltip text="Flash devices">
            <button
              className="w-12 h-12 border border-gray-100 bg-gray-700 rounded-full shadow-lg"
              onClick={handleFlashDevices}
            >
              <ArrowUpFromLine
                className="m-auto text-gray-100"
                strokeWidth={1.5}
              />
            </button>
          </DefaultTooltip>
        </div>

        <div className="w-full h-full">
          {availableBoards &&
          availableFirmwareVersions &&
          availableSerialPorts ? (
            <div className="flex flex-col gap-4 mx-auto max-w-[900px]">
              <div className="flex flex-col gap-4 p-4">
                {state.boards.map((boardOption, index) => (
                  <BoardOption
                    key={index}
                    boardOptionData={boardOption}
                    selectedBoard={findBoardByHwModel(
                      availableBoards,
                      boardOption.selectedHwModel
                    )}
                    requestState={
                      boardOption?.selectedPort
                        ? flashStates[boardOption.selectedPort] ?? null
                        : null
                    }
                    availableBoards={availableBoards}
                    availableSerialPorts={availableSerialPorts}
                    availableFirmwareVersions={availableFirmwareVersions}
                    deleteSelf={() => {
                      dispatch(createDeleteBoardAction(index));
                    }}
                    duplicateSelf={() => {
                      dispatch(createDuplicateBoardAction(index));
                    }}
                    setHwModel={(hwModel) => {
                      dispatch(createSetBoardHwModelAction(index, hwModel));
                    }}
                    setSerialPort={(port) => {
                      dispatch(createSetBoardPortAction(index, port));
                    }}
                    setFirmwareVersion={(version) => {
                      dispatch(createSetBoardVersionAction(index, version));
                    }}
                  />
                ))}
              </div>

              <button
                className="flex flex-row justify-center gap-2 px-4 w-full"
                onClick={() => {
                  dispatch(
                    createAddBoardAction({
                      selectedHwModel:
                        getFirstBoard(availableBoards)?.hwModel ?? null,
                      selectedPort: null,
                      selectedFirmwareVersion:
                        availableFirmwareVersions.stable?.[0].id ?? null,
                    })
                  );
                }}
              >
                <Plus className="text-gray-400" strokeWidth={1.5} />
                <p className="text-gray-500">Add Board</p>
              </button>
            </div>
          ) : (
            <Loader
              className="m-auto w-6 h-6 text-gray-500 animate-spin"
              strokeWidth={1.5}
            />
          )}
        </div>
      </div>
    </Dialog.Root>
  );
};

export default App;
