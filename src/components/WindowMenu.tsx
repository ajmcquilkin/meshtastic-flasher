import { open } from "@tauri-apps/plugin-shell";
import { getCurrent } from "@tauri-apps/plugin-window";
import * as Menubar from "@radix-ui/react-menubar";

export interface WindowMenuProps {
  showWelcomeScreen: () => void;
}

const WindowMenu = ({ showWelcomeScreen }: WindowMenuProps) => {
  const currentWindow = getCurrent();

  const handleQuitApp = async () => {
    // Close current window to quit, only works while app is single-windowed
    await currentWindow.close();
  };

  const handleToggleFullscreen = async () => {
    const isFullscreen = await currentWindow.isFullscreen();
    console.log("isFullscreen", isFullscreen);
    await currentWindow.setFullscreen(!isFullscreen);
  };

  const handleShowWelcomeScreen = async () => {
    showWelcomeScreen();
  };

  const handleReportBug = async () => {
    await open("https://github.com/ajmcquilkin/meshtastic-flasher/issues");
  };

  return (
    <Menubar.Root className="flex flex-row gap-3">
      <Menubar.Menu>
        <Menubar.Trigger className="text-sm text-gray-600">
          File
        </Menubar.Trigger>
        <Menubar.Portal>
          <Menubar.Content
            className="flex flex-col gap-1 px-4 py-2 bg-white border border-gray-100 rounded-lg shadow-lg"
            align="start"
            sideOffset={5}
            alignOffset={-3}
          >
            <Menubar.Item
              className="text-sm text-gray-600 cursor-pointer"
              onSelect={handleQuitApp}
            >
              Quit Application
            </Menubar.Item>
          </Menubar.Content>
        </Menubar.Portal>
      </Menubar.Menu>

      <Menubar.Menu>
        <Menubar.Trigger className="text-sm text-gray-600">
          View
        </Menubar.Trigger>
        <Menubar.Portal>
          <Menubar.Content
            className="flex flex-col gap-1 px-4 py-2 bg-white border border-gray-100 rounded-lg shadow-lg"
            align="start"
            sideOffset={5}
            alignOffset={-3}
          >
            <Menubar.Item
              className="text-sm text-gray-600 cursor-pointer"
              onSelect={handleToggleFullscreen}
            >
              Toggle Fullscreen
            </Menubar.Item>
          </Menubar.Content>
        </Menubar.Portal>
      </Menubar.Menu>

      <Menubar.Menu>
        <Menubar.Trigger className="text-sm text-gray-600">
          Help
        </Menubar.Trigger>
        <Menubar.Portal>
          <Menubar.Content
            className="flex flex-col gap-1 px-4 py-2 bg-white border border-gray-100 rounded-lg shadow-lg"
            align="start"
            sideOffset={5}
            alignOffset={-3}
          >
            <Menubar.Item
              className="text-sm text-gray-600 cursor-pointer"
              onSelect={handleShowWelcomeScreen}
            >
              Show welcome screen
            </Menubar.Item>
            <Menubar.Item
              className="text-sm text-gray-600 cursor-pointer"
              onSelect={handleReportBug}
            >
              Report a bug
            </Menubar.Item>
          </Menubar.Content>
        </Menubar.Portal>
      </Menubar.Menu>
    </Menubar.Root>
  );
};

export default WindowMenu;
