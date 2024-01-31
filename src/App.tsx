import { useEffect, useState } from "react";
import { appLogDir, join } from "@tauri-apps/api/path";
import { writeText } from "@tauri-apps/api/clipboard";
import { open } from "@tauri-apps/api/shell";
import { getCurrent } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import { info, error, debug, trace } from "tauri-plugin-log-api";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpFromLine, Loader, Plus } from "lucide-react";
import groupBy from "lodash.groupby";
import orderBy from "lodash.orderby";

import type {
  Board,
  ListBoardsResponse,
  ListFirmwareResponse,
  SerialPortInfo,
} from "./types/backend";
import BoardOption from "./components/BoardOption";
// import Titlebar from "./components/Titlebar";
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
import type {
  BoardArchitectureDictionary,
  BoardOptionData,
  FirmwareReleaseDictionary,
} from "./types/types";
import { usePersistentStore } from "./persistence";
import { openLink } from "./helpers";

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

  const currentWindow = getCurrent();
  const [isFullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const getIsFullscreen = async () => {
      setFullscreen(await currentWindow.isFullscreen());
    };

    getIsFullscreen();
  }, [currentWindow]);

  useEffect(() => {
    const unlistenRefreshSerialPorts = listen<string>(
      "refresh_serial_ports",
      (e) => {
        trace(`Received refresh_serial_ports event: ${e}`);
        handleRefreshSerialPorts();
      }
    );

    const unlistenShowWelcomeScreen = listen<string>(
      "show_welcome_screen",
      (e) => {
        trace(`Received show_welcome_screen event: ${e}`);
        handleShowWelcomeScreen();
      }
    );

    const unlistenToggleFullscreen = listen<string>(
      "toggle_fullscreen",
      (e) => {
        trace(`Received toggle_fullscreen event: ${e}`);
        handleToggleFullscreen();
      }
    );

    const unlistenRakWirelessDiscount = listen<string>(
      "rak_wireless_discount",
      (e) => {
        trace(`Received rak_wireless_discount event: ${e}`);
        handleOpenLink("https://rakwireless.kckb.st/ab922280");
      }
    );

    const unlistenSupportMyWork = listen<string>("support_my_work", (e) => {
      trace(`Received support_my_work event: ${e}`);
      handleOpenLink("https://github.com/sponsors/ajmcquilkin");
    });

    const unlistenCopyVersionNumber = listen<string>(
      "copy_version_number",
      (e) => {
        trace(`Received copy_version_number event: ${e}`);
        handleCopyVersionNumber();
      }
    );

    const unlistenCopyLogDirectory = listen<string>(
      "copy_log_directory",
      (e) => {
        trace(`Received copy_log_directory event: ${e}`);
        handleCopyLogDir();
      }
    );

    const unlistenOpenLogFile = listen<string>("open_log_file", (e) => {
      trace(`Received open_log_file event: ${e}`);
      handleOpenLogFile();
    });

    const unlistenReportBug = listen<string>("report_bug", (e) => {
      trace(`Received report_bug event: ${e}`);
      handleOpenLink(
        "https://github.com/ajmcquilkin/meshtastic-flasher/issues"
      );
    });

    return () => {
      unlistenRefreshSerialPorts.then((fn) => fn()).catch(console.error);
      unlistenShowWelcomeScreen.then((fn) => fn()).catch(console.error);
      unlistenToggleFullscreen.then((fn) => fn()).catch(console.error);
      unlistenRakWirelessDiscount.then((fn) => fn()).catch(console.error);
      unlistenSupportMyWork.then((fn) => fn()).catch(console.error);
      unlistenCopyVersionNumber.then((fn) => fn()).catch(console.error);
      unlistenCopyLogDirectory.then((fn) => fn()).catch(console.error);
      unlistenOpenLogFile.then((fn) => fn()).catch(console.error);
      unlistenReportBug.then((fn) => fn()).catch(console.error);
    };
  }, []);

  const handleRefreshSerialPorts = () => {
    getAvailableSerialPorts();
  };

  const handleCopyVersionNumber = async () => {
    try {
      info(`Writing app version to clipboard: ${APP_VERSION}`);
      await writeText(APP_VERSION);
      info("Wrote app version to clipboard");
    } catch (err) {
      error(`Failed to write app version to clipboard: ${err}`);
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      debug(`Fullscreen state before toggle: ${isFullscreen}`);
      await currentWindow.setFullscreen(!isFullscreen);
      setFullscreen(!isFullscreen);
      debug(`Fullscreen state after toggle: ${isFullscreen}`);
    } catch (err) {
      error(`Failed to toggle fullscreen: ${err}`);
    }
  };

  const handleShowWelcomeScreen = () => {
    handleUpdateShowWelcomeScreen(true);
  };

  // Tauri currently can't open directories natively
  const handleCopyLogDir = async () => {
    try {
      const logDir = await appLogDir();
      info(`Writing log directory to clipboard: ${logDir}`);
      await writeText(logDir);
      info("Wrote log directory to clipboard");
    } catch (err) {
      error(`Failed to copy log directory to clipboard: ${err}`);
    }
  };

  const handleOpenLogFile = async () => {
    try {
      const logFile = await join(await appLogDir(), "application.log");
      info(`Opening application log file: ${logFile}`);
      await open(logFile);
      info("Triggered request to open application log file");
    } catch (err) {
      error(`Failed to open application log file: ${err}`);
    }
  };

  const handleOpenLink = async (link: string) => {
    await openLink(link);
  };

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
  }, [handleUpdateShowWelcomeScreen, persistentStore]);

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
  }, [getBoards, getFirmwareReleases, getAvailableSerialPorts]);

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
        {/* Need to wait until Tauri v2.0.0 is stable */}
        {/* <Titlebar
          showWelcomeScreen={() => handleUpdateShowWelcomeScreen(true)}
          refreshSerialPorts={() => getAvailableSerialPorts()}
        /> */}
        <WelcomeScreen />
        <div className="absolute bottom-9 right-9">
          <DefaultTooltip text="Flash devices">
            <button
              className="w-12 h-12 border border-gray-100 bg-gray-700 rounded-full shadow-lg"
              type="button"
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
                    // biome-ignore lint/suspicious/noArrayIndexKey: No UUID to identify board option other than index
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
                type="button"
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
