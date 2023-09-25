import { appLogDir, join } from "@tauri-apps/api/path";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-shell";
import { getCurrent } from "@tauri-apps/plugin-window";
import * as Menubar from "@radix-ui/react-menubar";
import { error, info } from "@tauri-apps/plugin-log";
import {
  ActivityLogIcon,
  ClipboardCopyIcon,
  DesktopIcon,
  EnterFullScreenIcon,
  ExitFullScreenIcon,
  ExitIcon,
} from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

export interface WindowMenuProps {
  showWelcomeScreen: () => void;
}

const WindowMenu = ({ showWelcomeScreen }: WindowMenuProps) => {
  const currentWindow = getCurrent();
  const [isFullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const getIsFullscreen = async () => {
      setFullscreen(await currentWindow.isFullscreen());
    };

    getIsFullscreen();
  }, [currentWindow]);

  const handleQuitApp = async () => {
    try {
      await invoke("quit_application");
    } catch (err) {
      error(`Failed to close current window: ${err}`);
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      await currentWindow.setFullscreen(!isFullscreen);
      setFullscreen(!isFullscreen);
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
            className="flex flex-col gap-2 px-4 py-3 bg-white border border-gray-100 rounded-lg shadow-lg"
            align="start"
            sideOffset={5}
            alignOffset={-3}
          >
            <Menubar.Item
              className="flex flex-row gap-3 cursor-pointer"
              onSelect={handleQuitApp}
            >
              <ExitIcon className="my-auto text-gray-600" />
              <p className="text-sm text-gray-600">Quit Application</p>
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
            className="flex flex-col gap-2 px-4 py-3 bg-white border border-gray-100 rounded-lg shadow-lg"
            align="start"
            sideOffset={5}
            alignOffset={-3}
          >
            <Menubar.Item
              className="flex flex-row gap-3 cursor-pointer"
              onSelect={handleToggleFullscreen}
            >
              {isFullscreen ? (
                <ExitFullScreenIcon className="my-auto text-gray-600" />
              ) : (
                <EnterFullScreenIcon className="my-auto text-gray-600" />
              )}

              <p className="text-sm text-gray-600">
                {isFullscreen ? "Exit fullscreen" : "Enable fullscreen"}
              </p>
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
            className="flex flex-col gap-2 px-4 py-3 bg-white border border-gray-100 rounded-lg shadow-lg"
            align="start"
            sideOffset={5}
            alignOffset={-3}
          >
            <Menubar.Item
              className="flex flex-row gap-3 cursor-pointer"
              onSelect={handleShowWelcomeScreen}
            >
              <ExitIcon className="my-auto text-gray-600" />
              <p className="text-sm text-gray-600">Show welcome screen</p>
            </Menubar.Item>

            <Menubar.Separator className="h-px bg-gray-300 my-1" />

            <Menubar.Item
              className="flex flex-row gap-3 cursor-pointer"
              onSelect={handleCopyLogDir}
            >
              <ClipboardCopyIcon className="my-auto text-gray-600" />
              <p className="text-sm text-gray-600">
                Copy log directory to clipboard
              </p>
            </Menubar.Item>
            <Menubar.Item
              className="flex flex-row gap-3 cursor-pointer"
              onSelect={handleOpenWebviewLogFile}
            >
              <DesktopIcon className="my-auto text-gray-600" />
              <p className="text-sm text-gray-600">Open webview log file</p>
            </Menubar.Item>
            <Menubar.Item
              className="flex flex-row gap-3 cursor-pointer"
              onSelect={handleOpenBackendLogFile}
            >
              <ActivityLogIcon className="my-auto text-gray-600" />
              <p className="text-sm text-gray-600">Open backend log file</p>
            </Menubar.Item>

            <Menubar.Separator className="h-px bg-gray-300 my-1" />

            <Menubar.Item
              className="flex flex-row gap-3 cursor-pointer"
              onSelect={handleReportBug}
            >
              <ExitIcon className="my-auto text-gray-600" />
              <p className="text-sm text-gray-600">Report a bug</p>
            </Menubar.Item>
          </Menubar.Content>
        </Menubar.Portal>
      </Menubar.Menu>
    </Menubar.Root>
  );
};

export default WindowMenu;
