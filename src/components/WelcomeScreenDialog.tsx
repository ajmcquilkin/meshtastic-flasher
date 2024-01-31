import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Rak19007Render from "../assets/rak-19007-render.webp";

const WelcomeScreenDialog = () => {
  return (
    <Dialog.Portal>
      {/* Tracking https://github.com/radix-ui/primitives/issues/1159 */}
      <div className="fixed inset-0 bg-gray-900/[0.4]" />

      <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col default-overlay">
        <div className="flex flex-row max-w-[80vw] max-h-[80vh] rounded-lg">
          <div className="hidden md:block my-auto w-[500px] relative flex-1">
            <img src={Rak19007Render} alt="Render of RAK19007 board" />
          </div>

          <div className="flex-1 flex flex-col gap-4 pl-9 pr-11 py-7 w-96 overflow-auto">
            <Dialog.Title className="text-base font-medium text-gray-700">
              Welcome
            </Dialog.Title>

            <Dialog.Description className="text-sm font-normal text-gray-500">
              Welcome to the Meshtastic project! This application allows you to
              flash your Meshtastic devices with recently released firmware
              versions. This tool supports both NRF and ESP32 based devices.
            </Dialog.Description>

            <p className="text-sm font-normal text-gray-500">
              This tool is completely open-source and community developed. If
              you have trouble installing or using this tool, please file an
              issue in the &quot;Help&quot; menu.
            </p>

            <h2 className="text-base font-medium text-gray-700">
              Flashing Information
            </h2>

            <p className="text-sm font-normal text-gray-500">
              This tool supports both NRF and ESP32 based devices. If you are
              using an ESP32 based device, your device will be ready to flash
              once it is recognized by your computer. For NRF based devices, you
              will need to put your device into bootloader mode by
              double-clicking the reset button on the board. On RAK-based
              devices, this button will be directly beside the USB port. Your
              device is ready to flash when your computer mounts a new drive
              with the name of the device.
            </p>

            <Dialog.Close asChild>
              <button
                className="mr-auto px-4 py-2 bg-gray-700 text-gray-50 rounded-lg border border-gray-100 hover:shadow-md transition-shadow"
                type="button"
                aria-label={"Close dialog"}
              >
                Get started
              </button>
            </Dialog.Close>
          </div>
        </div>

        <Dialog.Close asChild>
          <button
            className="fixed top-7 right-9 w-6 h-6 text-gray-500 hover:text-gray-600 transition-colors"
            type="button"
            aria-label={"Close dialog"}
          >
            <X strokeWidth={1.5} />
          </button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
};

export default WelcomeScreenDialog;
