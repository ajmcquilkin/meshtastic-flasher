import { WindowTitlebar } from "tauri-controls";
import MeshLogoDark from "../assets/Mesh_Logo_Dark.svg";
import WindowMenu from "./WindowMenu";

export interface TitlebarProps {
  showWelcomeScreen: () => void;
}

const Titlebar = ({ showWelcomeScreen }: TitlebarProps) => {
  return (
    <WindowTitlebar className="" data-tauri-drag-region>
      <div className="flex flex-row gap-3 mx-3">
        <img src={MeshLogoDark} className="my-auto h-3" />

        <div className="flex flex-row align-middle my-auto gap-3">
          <WindowMenu showWelcomeScreen={showWelcomeScreen} />
        </div>
      </div>
    </WindowTitlebar>
  );
};

export default Titlebar;
