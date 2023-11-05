import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { Store } from "@tauri-apps/plugin-store";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpFromLine, Loader, Plus } from "lucide-react";
import { info, error } from "@tauri-apps/plugin-log";

import {
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
import { BoardOptionData } from "./types/types";

const App = () => {
  const [listFirmwareReponse, setListFirmwareResponse] =
    useState<ListFirmwareResponse | null>(null);
  const [listBoardsResponse, setListBoardsResponse] =
    useState<ListBoardsResponse | null>(null);
  const [availableSerialPorts, setAvailableSerialPorts] = useState<
    SerialPortInfo[] | null
  >(null);

  const [flashStates, setFlashStates] = useState<{
    [port: string]: "pending" | "success" | "error" | null;
  }>({});

  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);

  const [state, dispatch] = useAppReducer();

  useEffect(() => {
    const handleCreateStore = async () => {
      const store = new Store(".settings.dat");
      const hasSeenWelcomeScreen = await store.get("hasSeenWelcomeScreen");

      if (!hasSeenWelcomeScreen) {
        setShowWelcomeScreen(true);
        info("Persisting that user has seen welcome screen");
        await store.set("hasSeenWelcomeScreen", true);
      } else {
        info("User has already seen welcome screen");
      }
    };

    handleCreateStore();
  }, []);

  const getBoards = async () => {
    const boards = (await invoke(
      "fetch_supported_boards"
    )) as ListBoardsResponse;
    info(`Received ${boards.length} boards from backend`);
    setListBoardsResponse(boards);
  };

  const getFirmwareReleases = async () => {
    const releases = (await invoke(
      "fetch_firmware_releases"
    )) as ListFirmwareResponse;
    info(
      `Received ${releases.releases.alpha.length} alpha and ${releases.releases.stable.length} stable firmware releases from backend`
    );
    setListFirmwareResponse(releases);
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
    <Dialog.Root open={showWelcomeScreen} onOpenChange={setShowWelcomeScreen}>
      <div className="relative w-full min-h-screen bg-white">
        <Titlebar
          showWelcomeScreen={() => setShowWelcomeScreen(true)}
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
          {listBoardsResponse && listFirmwareReponse && availableSerialPorts ? (
            <div className="flex flex-col gap-4 mx-auto max-w-[900px]">
              <div className="flex flex-col gap-4 p-4">
                {state.boards.map((boardOption, index) => (
                  <BoardOption
                    key={index}
                    boardOptionData={boardOption}
                    selectedBoard={
                      listBoardsResponse.find(
                        (b) => b.hwModel === boardOption.selectedHwModel
                      ) ?? null
                    }
                    requestState={
                      boardOption?.selectedPort
                        ? flashStates[boardOption.selectedPort] ?? null
                        : null
                    }
                    availableBoards={listBoardsResponse}
                    availableFirmwareVersions={listFirmwareReponse.releases}
                    availableSerialPorts={availableSerialPorts}
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
                      selectedHwModel: listBoardsResponse?.[0].hwModel ?? null,
                      selectedPort: null,
                      selectedFirmwareVersion:
                        listFirmwareReponse.releases.stable?.[0].id ?? null,
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
