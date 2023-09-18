import { useState } from "react";
import type { ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

export interface IDefaultTooltipProps extends Tooltip.TooltipContentProps {
  text: string;
  children: ReactNode;
  deactivated?: boolean;
}

const DefaultTooltip = ({
  text,
  children,
  deactivated,
  ...rest
}: IDefaultTooltipProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Tooltip.Provider>
      <Tooltip.Root
        open={isOpen}
        onOpenChange={(e) => setIsOpen(e && !deactivated)}
        delayDuration={300}
      >
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 px-4 py-2 shadow-lg rounded-lg bg-white border border-gray-200 text-sm font-light text-gray-400"
            sideOffset={5}
            avoidCollisions
            collisionPadding={20}
            side={rest.side ?? "top"}
          >
            {text}
            <Tooltip.Arrow className="fill-gray-200 dark:fill-gray-600" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default DefaultTooltip;
