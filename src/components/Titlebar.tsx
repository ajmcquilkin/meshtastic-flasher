import { WindowTitlebar } from "tauri-controls";
import WindowMenu from "./WindowMenu";
import { openLink } from "../helpers";
import MeshLogoDark from "../assets/Mesh_Logo_Dark.svg";

export interface TitlebarProps {
  showWelcomeScreen: () => void;
  refreshSerialPorts: () => void;
}

const Titlebar = ({ showWelcomeScreen, refreshSerialPorts }: TitlebarProps) => {
  return (
    <WindowTitlebar className="" data-tauri-drag-region>
      <div className="flex flex-row gap-3 mx-3">
        <button onClick={() => openLink("https://meshtastic.org/")}>
          <img src={MeshLogoDark} className="my-auto h-3" />
        </button>

        <div className="flex flex-row align-middle my-auto gap-3">
          <WindowMenu
            showWelcomeScreen={showWelcomeScreen}
            refreshSerialPorts={refreshSerialPorts}
          />
        </div>
      </div>
    </WindowTitlebar>
  );
};

export default Titlebar;
