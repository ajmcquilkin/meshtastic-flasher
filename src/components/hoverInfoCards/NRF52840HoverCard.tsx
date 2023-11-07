import * as HoverCard from "@radix-ui/react-hover-card";
import { InfoCircledIcon } from "@radix-ui/react-icons";

import DefaultTooltip from "../generic/DefaultTooltip";
import Rak19007Render from "../../assets/rak-19007-render.webp";

const NRF52840HoverCard = () => {
  return (
    <HoverCard.Root>
      <HoverCard.Trigger asChild>
        <div className="flex flex-row gap-2 cursor-pointer">
          <p className="my-auto text-sm font-medium text-gray-600">nRF52840</p>
          <InfoCircledIcon className="my-auto text-gray-500" />
        </div>
      </HoverCard.Trigger>

      <HoverCard.Portal>
        <HoverCard.Content className="p-4 default-overlay" sideOffset={5}>
          <div className="w-96">
            <div className="relative w-96 h-96">
              <img src={Rak19007Render} alt="Render of RAK 19007" />

              <DefaultTooltip text="Reset Button (RST)" delayDuration={0}>
                <div
                  className="absolute top-[271px] left-[119px] -translate-x-1/2 -translate-y-1/2 w-8 h-8 hover:w-12 hover:h-12 bg-green-400/40 border-2 border-green-400/60 rounded-lg"
                  style={{
                    transition:
                      "width 80ms ease-in-out, height 80ms ease-in-out",
                  }}
                />
              </DefaultTooltip>
            </div>

            <div className="flex flex-col gap-23">
              <div className="flex flex-row gap-3 align-baseline">
                <h2 className="text-lg font-light text-gray-700">
                  nRF52840 Selected
                </h2>
                <p className="mt-auto mb-1 text-xs font-medium text-gray-400">
                  RAK 19007 shown
                </p>
              </div>

              <p className="text-base font-normal text-gray-600">
                To place an <code>nr52840</code> into boot mode, you must:
              </p>

              <ol className="ml-8 list-decimal">
                <li className="pl-1 text-base font-normal text-gray-600">
                  Quickly double-press the{" "}
                  <mark className="px-1 py-0.5 text-gray-900 bg-green-400/40">
                    RST
                  </mark>{" "}
                  button
                </li>
                <li className="pl-1 text-base font-normal text-gray-600">
                  The device will then mount as a mass storage device on your
                  computer
                </li>
              </ol>

              <p className="text-base font-normal text-gray-600">
                The device is now ready to be flashed.
              </p>
            </div>
          </div>

          <HoverCard.Arrow className="fill-gray-300" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
};

export default NRF52840HoverCard;
