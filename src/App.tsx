import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { Store } from "@tauri-apps/plugin-store";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpFromLine, Plus } from "lucide-react";

import {
  ListBoardsResponse,
  ListFirmwareResponse,
  SerialPortInfo,
} from "./types";
import BoardOption, { BoardOptionData } from "./components/BoardOption";
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
        await store.set("hasSeenWelcomeScreen", true);
      }
    };

    handleCreateStore();
  }, []);

  const getBoards = async () => {
    const boards = (await invoke(
      "fetch_supported_boards"
    )) as ListBoardsResponse;
    console.info(boards);
    setListBoardsResponse(boards);
  };

  const getFirmwareReleases = async () => {
    const releases = (await invoke(
      "fetch_firmware_releases"
    )) as ListFirmwareResponse;
    console.info(releases);
    setListFirmwareResponse(releases);
  };

  const getAvailableSerialPorts = async () => {
    const ports = (await invoke(
      "get_available_serial_ports"
    )) as SerialPortInfo[];
    console.info(ports);
    setAvailableSerialPorts(ports);
  };

  useEffect(() => {
    getBoards();
    getFirmwareReleases();
    getAvailableSerialPorts();
  }, []);

  const flashDevice = async (board: BoardOptionData) => {
    try {
      setFlashStates((prev) => ({ ...prev, [board.port]: "pending" }));

      await invoke("flash_device", {
        hwModel: board.hwModel,
        uploadPort: board.port,
        firmwareVersionId: board.firmwareVersion,
      });

      setFlashStates((prev) => ({ ...prev, [board.port]: "success" }));
    } catch (error) {
      console.error(error);
      setFlashStates((prev) => ({ ...prev, [board.port]: "error" }));
    }
  };

  const handleFlashDevices = async () => {
    Promise.all(state.boards.map((b) => flashDevice(b)))
      .then(() => console.info("Flashing completed"))
      .catch((e) => console.error("Flashing failed", e));
  };

  return (
    <Dialog.Root open={showWelcomeScreen} onOpenChange={setShowWelcomeScreen}>
      <div className="relative w-full min-h-screen bg-white">
        <Titlebar showWelcomeScreen={() => setShowWelcomeScreen(true)} />

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

        {listBoardsResponse && listFirmwareReponse && availableSerialPorts && (
          <div className="flex flex-col gap-4 mx-auto max-w-[900px]">
            <div className="flex flex-col gap-4 p-4">
              {state.boards.map((boardOption, index) => (
                <BoardOption
                  key={index}
                  board={boardOption}
                  activelySupported={
                    listBoardsResponse.find(
                      (b) => b.hwModel === boardOption.hwModel
                    )?.activelySupported ?? false
                  }
                  requestState={flashStates[boardOption.port] ?? null}
                  availableBoards={listBoardsResponse}
                  availableFirmwareVersions={listFirmwareReponse.releases}
                  availableSerialPorts={availableSerialPorts}
                  setFirmwareVersion={(version) => {
                    dispatch(createSetBoardVersionAction(index, version));
                  }}
                  deleteSelf={() => {
                    dispatch(createDeleteBoardAction(index));
                  }}
                  duplicateSelf={() => {
                    dispatch(createDuplicateBoardAction(index));
                  }}
                  setHwModel={(hwModel) => {
                    dispatch(createSetBoardHwModelAction(index, hwModel));
                  }}
                  setPort={(port) => {
                    dispatch(createSetBoardPortAction(index, port));
                  }}
                />
              ))}
            </div>

            <button
              className="flex flex-row justify-center gap-2 px-4 w-full"
              onClick={() => {
                dispatch(
                  createAddBoardAction({
                    firmwareVersion: listFirmwareReponse.releases.stable[0].id,
                    hwModel: listBoardsResponse[0].hwModel,
                    port: "",
                  })
                );
              }}
            >
              <Plus className="text-gray-400" strokeWidth={1.5} />
              <p className="text-gray-700">Add Board</p>
            </button>
          </div>
        )}
      </div>
    </Dialog.Root>
  );
};

export default App;
