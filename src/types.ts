export type FirmwareRelease = {
  id: string;
  title: string;
  page_url: string;
  zip_url: string;
};

export type PullRequest = {
  id: string;
  title: string;
  page_url: string;
  zip_url: string;
};

export type ListFirmwareResponse = {
  releases: { stable: FirmwareRelease[]; alpha: FirmwareRelease[] };
  pullRequests: PullRequest[];
};

export type ListBoardsResponse = Board[];

export type Board = {
  hwModel: number;
  hwModelSlug: string;
  platformioTarget: string;
  architecture: string;
  activelySupported: boolean;
  displayName: string;
};

export type SerialPortInfo = {
  port_name: string;
  port_type:
    | string
    | {
        UsbPort: {
          manufacturer: string;
          pid: number;
          vid: number;
          product: string;
          serial_number: string;
        };
      };
};
