import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";

type FirmwareRelease = {
  id: string;
  title: string;
  page_url: string;
  zip_url: string;
};

type PullRequest = {
  id: string;
  title: string;
  page_url: string;
  zip_url: string;
};

type ListFirmwareResponse = {
  releases: { stable: FirmwareRelease[]; alpha: FirmwareRelease[] };
  pullRequests: PullRequest[];
};

type ListBoardsResponse = Board[];

type Board = {
  hwModel: number;
  hwModelSlug: string;
  platformioTarget: string;
  architecture: string;
  activelySupported: boolean;
};

const App = () => {
  const [listFirmwareReponse, setListFirmwareResponse] =
    useState<ListFirmwareResponse | null>(null);
  const [listBoardsResponse, setListBoardsResponse] =
    useState<ListBoardsResponse | null>(null);

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

  useEffect(() => {
    getBoards();
    getFirmwareReleases();
  }, []);

  return (
    <div className="container">
      <h1>Welcome to Tauri!</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <div>
        <h2>Firmware Releases</h2>
        <ul className="list-none">
          {listFirmwareReponse &&
            listFirmwareReponse.releases.stable.map((release) => (
              <li key={release.id}>{release.title}</li>
            ))}
        </ul>
      </div>

      <div>
        <h2>Supported Boards</h2>
        <ul className="list-none">
          {listBoardsResponse &&
            listBoardsResponse.map((board) => (
              <li key={board.hwModelSlug}>{board.hwModelSlug}</li>
            ))}
        </ul>
      </div>
    </div>
  );
};

export default App;
