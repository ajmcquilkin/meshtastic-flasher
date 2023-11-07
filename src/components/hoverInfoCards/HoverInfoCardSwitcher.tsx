import NRF52840HoverCard from "./NRF52840HoverCard";
import ESP32S3HoverCard from "./ESP32S3HoverCard";

export interface IHoverInfoCardSwitcherProps {
  architecture: string;
}

const HoverInfoCardSwitcher = ({
  architecture,
}: IHoverInfoCardSwitcherProps) => {
  switch (architecture.toLocaleLowerCase()) {
    case "esp32-s3":
      return <ESP32S3HoverCard />;
    case "nrf52840":
      return <NRF52840HoverCard />;
    default:
      return null;
  }
};

export default HoverInfoCardSwitcher;
