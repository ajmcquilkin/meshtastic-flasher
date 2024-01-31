import { useReducer } from "react";
import type { BoardOptionData } from "../types/types";
import type {
  AddBoardAction,
  DeleteBoardAction,
  DuplicateBoardAction,
  SetBoardHwModelAction,
  SetBoardPortAction,
  SetBoardVersionAction,
} from "./actions";

export type BoardOptionsState = {
  boards: BoardOptionData[];
};

const initialState: BoardOptionsState = {
  boards: [],
};

export type Action =
  | SetBoardHwModelAction
  | SetBoardPortAction
  | SetBoardVersionAction
  | AddBoardAction
  | DuplicateBoardAction
  | DeleteBoardAction;

export const reducer = (
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
            selectedHwModel: hwModel,
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
            selectedPort: port,
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
            selectedFirmwareVersion: version,
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

export const useAppReducer = () => {
  return useReducer(reducer, initialState);
};
