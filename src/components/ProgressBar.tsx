import * as Progress from "@radix-ui/react-progress";

export interface ProgressBarProps {
  progressPercentage: number;
  className?: string;
}

const ProgressBar = ({
  progressPercentage,
  className = "",
}: ProgressBarProps) => {
  return (
    <div className={`${className}`}>
      <Progress.Root
        className="relative h-3 w-full border-2 border-gray-300 bg-gray-50 rounded-full overflow-hidden"
        style={{ transform: "translateZ(0)" }} // Fix for Safari
        value={progressPercentage}
      >
        <Progress.Indicator
          className="w-full h-full bg-gray-600 rounded-full transition-transform"
          style={{ transform: `translateX(-${100 - progressPercentage}%)` }}
        />
      </Progress.Root>
    </div>
  );
};

export default ProgressBar;
