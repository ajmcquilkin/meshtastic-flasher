import { useEffect, useReducer, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import {
  ListBoardsResponse,
  ListFirmwareResponse,
  SerialPortInfo,
} from "./types";
import BoardOption, { BoardOptionData } from "./components/BoardOption";
import { Cpu, Plus } from "lucide-react";

type BoardOptionsState = {
  boards: BoardOptionData[];
};

const initialState: BoardOptionsState = {
  boards: [],
};

type Action =
  | { type: "set_board_hw_model"; payload: { index: number; hwModel: number } }
  | { type: "set_board_port"; payload: { index: number; port: string } }
  | { type: "set_board_version"; payload: { index: number; version: string } }
  | { type: "add_board"; payload: BoardOptionData }
  | { type: "duplicate_board"; payload: { index: number } }
  | { type: "delete_board"; payload: { index: number } };

const reducer = (
  state: BoardOptionsState,
  action: Action
): BoardOptionsState => {
  switch (action.type) {
    case "set_board_hw_model": {
      const { index, hwModel } = action.payload;

      // Update only board at index
      const boards = state.boards.map((board, i) => {
        if (i === index) {
          return {
            ...board,
            hwModel,
          };
        }

        return board;
      });

      return {
        ...state,
        boards,
      };
    }

    case "set_board_port": {
      const { index, port } = action.payload;

      // Update only board at index
      const boards = state.boards.map((board, i) => {
        if (i === index) {
          return {
            ...board,
            port,
          };
        }
        return board;
      });

      return {
        ...state,
        boards,
      };
    }

    case "set_board_version": {
      const { index, version } = action.payload;

      // Update only board at index
      const boards = state.boards.map((board, i) => {
        if (i === index) {
          return {
            ...board,
            firmwareVersion: version,
          };
        }
        return board;
      });

      return {
        ...state,
        boards,
      };
    }

    case "add_board": {
      const { boards } = state;

      const updated_boards = [...boards, action.payload];

      return {
        ...state,
        boards: updated_boards,
      };
    }

    case "duplicate_board": {
      const { index } = action.payload;

      const boards = [...state.boards];
      const board = boards[index];
      boards.splice(index, 0, board);

      return {
        ...state,
        boards,
      };
    }

    case "delete_board": {
      const { index } = action.payload;

      const boards = [...state.boards];
      boards.splice(index, 1);

      return {
        ...state,
        boards,
      };
    }

    default:
      return state;
  }
};

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

  const [state, dispatch] = useReducer(reducer, initialState);

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
    <div className="w-full min-h-screen bg-white">
      <h1 className="text-4xl font-semibold text-gray-700 text-center pt-8 pb-4">
        Meshtastic Flasher
      </h1>

      <button
        className="flex flex-row justify-center gap-2 px-4 w-full"
        onClick={handleFlashDevices}
      >
        <Cpu className="text-gray-400" strokeWidth={1.5} />
        <p className="text-gray-700">Flash Devices</p>
      </button>

      {listBoardsResponse && listFirmwareReponse && availableSerialPorts && (
        <div className="flex flex-col gap-4">
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
                  dispatch({
                    type: "set_board_version",
                    payload: {
                      index,
                      version,
                    },
                  });
                }}
                deleteSelf={() => {
                  dispatch({
                    type: "delete_board",
                    payload: {
                      index,
                    },
                  });
                }}
                duplicateSelf={() => {
                  dispatch({
                    type: "duplicate_board",
                    payload: {
                      index,
                    },
                  });
                }}
                setHwModel={(hwModel) => {
                  dispatch({
                    type: "set_board_hw_model",
                    payload: {
                      index,
                      hwModel,
                    },
                  });
                }}
                setPort={(port) => {
                  dispatch({
                    type: "set_board_port",
                    payload: {
                      index,
                      port,
                    },
                  });
                }}
              />
            ))}
          </div>

          <button
            className="flex flex-row justify-center gap-2 px-4 w-full"
            onClick={() =>
              dispatch({
                type: "add_board",
                payload: {
                  firmwareVersion: listFirmwareReponse.releases.stable[0].id,
                  hwModel: listBoardsResponse[0].hwModel,
                  port: "",
                },
              })
            }
          >
            <Plus className="text-gray-400" strokeWidth={1.5} />
            <p className="text-gray-700">Add Board</p>
          </button>
        </div>
      )}

      {/* <div>
        <h2>Firmware Releases</h2>
        <ul className="list-none">
          {listFirmwareReponse &&
            listFirmwareReponse.releases.stable.map((release) => (
              <li key={release.id}>{release.title}</li>
            ))}
        </ul>
      </div> */}

      {/* <div>
        <h2>Supported Boards</h2>
        <ul className="list-none">
          {listBoardsResponse &&
            listBoardsResponse.map((board) => (
              <li key={board.hwModelSlug}>{board.hwModelSlug}</li>
            ))}
        </ul>
      </div> */}
    </div>
  );
};

export default App;
