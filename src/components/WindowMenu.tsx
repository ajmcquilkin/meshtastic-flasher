import { appLogDir, join } from "@tauri-apps/api/path";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-shell";
import { getCurrent } from "@tauri-apps/plugin-window";
import * as Menubar from "@radix-ui/react-menubar";
import { error, info } from "@tauri-apps/plugin-log";

export interface WindowMenuProps {
  showWelcomeScreen: () => void;
}

const WindowMenu = ({ showWelcomeScreen }: WindowMenuProps) => {
  const currentWindow = getCurrent();

  const handleQuitApp = async () => {
    try {
      // Close current window to quit, only works while app is single-windowed
      await currentWindow.close();
    } catch (err) {
      error(`Failed to close current window: ${err}`);
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      const isFullscreen = await currentWindow.isFullscreen();
      await currentWindow.setFullscreen(!isFullscreen);
    } catch (err) {
      error(`Failed to toggle fullscreen: ${err}`);
    }
  };

  const handleShowWelcomeScreen = () => {
    showWelcomeScreen();
  };

  // Tauri currently can't open directories natively
  const handleCopyLogDir = async () => {
    try {
      const logDir = await appLogDir();
      info(`Writing log directory to clipboard: ${logDir}`);
      await writeText(logDir);
      info("Wrote log directory to clipboard");
    } catch (err) {
      error(`Failed to copy log directory to clipboard: ${err}`);
    }
  };

  const handleOpenWebviewLogFile = async () => {
    try {
      const logFile = await join(await appLogDir(), "webview.log");
      info(`Opening application web logs: ${logFile}`);
      await open(logFile);
      info("Triggered request to open application web logs");
    } catch (err) {
      error(`Failed to open web log file: ${err}`);
    }
  };

  const handleOpenBackendLogFile = async () => {
    try {
      const logFile = await join(await appLogDir(), "backend.log");
      info(`Opening application backend logs: ${logFile}`);
      await open(logFile);
      info("Triggered request to open backend logs");
    } catch (err) {
      error(`Failed to open backend log file: ${err}`);
    }
  };

  const handleReportBug = async () => {
    try {
      await open("https://github.com/ajmcquilkin/meshtastic-flasher/issues");
    } catch (err) {
      error(`Failed to open bug report URL: ${err}`);
    }
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
              onSelect={handleCopyLogDir}
            >
              Copy log directory to clipboard
            </Menubar.Item>
            <Menubar.Item
              className="text-sm text-gray-600 cursor-pointer"
              onSelect={handleOpenWebviewLogFile}
            >
              Open webview log file
            </Menubar.Item>
            <Menubar.Item
              className="text-sm text-gray-600 cursor-pointer"
              onSelect={handleOpenBackendLogFile}
            >
              Open backend log file
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
