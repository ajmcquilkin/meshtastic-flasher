import { WindowTitlebar } from "tauri-controls";
import MeshLogoDark from "../assets/Mesh_Logo_Dark.svg";

const Titlebar = () => {
  return (
    <WindowTitlebar className="">
      <div className="flex flex-row gap-2 mx-3">
        <img src={MeshLogoDark} className="my-auto h-3" />

        <p className="my-auto text-sm font-normal text-gray-700">
          Meshtastic Flasher
        </p>
      </div>
    </WindowTitlebar>
  );
};

export default Titlebar;
