import type { BoardOptionData } from "../types/types";

export type SetBoardHwModelAction = {
  type: "set_board_hw_model";
  payload: {
    index: number;
    hwModel: number;
  };
};

export const createSetBoardHwModelAction = (
  index: number,
  hwModel: number,
): SetBoardHwModelAction => ({
  type: "set_board_hw_model",
  payload: {
    index,
    hwModel,
  },
});

export type SetBoardPortAction = {
  type: "set_board_port";
  payload: {
    index: number;
    port: string;
  };
};

export const createSetBoardPortAction = (
  index: number,
  port: string,
): SetBoardPortAction => ({
  type: "set_board_port",
  payload: {
    index,
    port,
  },
});

export type SetBoardVersionAction = {
  type: "set_board_version";
  payload: {
    index: number;
    version: string;
  };
};

export const createSetBoardVersionAction = (
  index: number,
  version: string,
): SetBoardVersionAction => ({
  type: "set_board_version",
  payload: {
    index,
    version,
  },
});

export type AddBoardAction = {
  type: "add_board";
  payload: BoardOptionData;
};

export const createAddBoardAction = (
  board: BoardOptionData,
): AddBoardAction => ({
  type: "add_board",
  payload: board,
});

export type DuplicateBoardAction = {
  type: "duplicate_board";
  payload: {
    index: number;
  };
};

export const createDuplicateBoardAction = (
  index: number,
): DuplicateBoardAction => ({
  type: "duplicate_board",
  payload: {
    index,
  },
});

export type DeleteBoardAction = {
  type: "delete_board";
  payload: {
    index: number;
  };
};

export const createDeleteBoardAction = (index: number): DeleteBoardAction => ({
  type: "delete_board",
  payload: {
    index,
  },
});
