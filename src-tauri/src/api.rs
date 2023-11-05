pub const MESHTASTIC_API_URL: &str = "https://api.meshtastic.org";

pub mod boards {
    pub type ListBoardsResponse = Vec<Board>;

    #[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Board {
        pub hw_model: u32,
        pub hw_model_slug: String,
        pub platformio_target: String,
        pub architecture: String,
        pub actively_supported: bool,
        pub display_name: String,
    }
}

pub mod firmware {
    #[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct ListFirmwareResponse {
        pub releases: FirmwareReleases,
        pub pull_requests: Vec<PullRequest>,
    }

    #[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
    pub struct FirmwareReleases {
        pub stable: Vec<FirmwareRelease>,
        pub alpha: Vec<FirmwareRelease>,
    }

    #[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
    pub struct FirmwareRelease {
        pub id: String,
        pub title: String,
        pub page_url: String,
        pub zip_url: String,
    }

    #[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
    pub struct PullRequest {
        pub id: String,
        pub title: String,
        pub page_url: String,
        pub zip_url: String,
    }
}

pub async fn fetch_supported_boards() -> Result<boards::ListBoardsResponse, String> {
    log::info!("Called \"fetch_supported_boards\" command with no args");

    let response =
        match reqwest::get(format!("{}/resource/deviceHardware", MESHTASTIC_API_URL)).await {
            Ok(response) => response,
            Err(e) => {
                log::error!(
                    "Error while building response for fetching device hardware: {}",
                    e.to_string()
                );

                return Err(format!(
                    "Error while building response for fetching device hardware: {}",
                    e
                ));
            }
        };

    let response_text = match response.text().await {
        Ok(response_text) => response_text,
        Err(e) => {
            log::error!(
                "Error while sending request to get device hardware: {}",
                e.to_string()
            );

            return Err(format!(
                "Error while sending request to get device hardware: {}",
                e
            ));
        }
    };

    let boards_response: boards::ListBoardsResponse = match serde_json::from_str(&response_text) {
        Ok(boards_response) => boards_response,
        Err(e) => {
            log::error!(
                "Error while parsing response for fetching device hardware: {}",
                e.to_string()
            );

            return Err(format!(
                "Error while parsing response for fetching device hardware: {}",
                e
            ));
        }
    };

    Ok(boards_response)
}

pub async fn fetch_firmware_releases() -> Result<firmware::ListFirmwareResponse, String> {
    let response = match reqwest::get(format!("{}/github/firmware/list", MESHTASTIC_API_URL)).await
    {
        Ok(response) => response,
        Err(e) => {
            log::error!(
                "Error while building response for fetching firmware releases: {}",
                e.to_string()
            );
            return Err(format!(
                "Error while building response for fetching firmware releases: {}",
                e
            ));
        }
    };

    let response_text = match response.text().await {
        Ok(response_text) => response_text,
        Err(e) => {
            log::error!(
                "Error while sending request to get firmware releases: {}",
                e.to_string()
            );
            return Err(format!(
                "Error while sending request to get firmware releases: {}",
                e
            ));
        }
    };

    let list_firmware_response: firmware::ListFirmwareResponse =
        serde_json::from_str(&response_text).map_err(|e| e.to_string())?;

    Ok(list_firmware_response)
}

pub async fn fetch_firmware_bundle(firmware_zip_url: String) -> Result<bytes::Bytes, String> {
    log::info!("Downloading firmware from {}", firmware_zip_url.clone());

    let response = match reqwest::get(firmware_zip_url.clone()).await {
        Ok(response) => response,
        Err(e) => {
            log::error!(
                "Error while building response for downloading firmware at URL {}: {}",
                firmware_zip_url,
                e.to_string()
            );

            return Err(format!(
                "Error while building response for downloading firmware: {}",
                e
            ));
        }
    };

    log::info!("Successfully created request to fetch firmware");

    let bytes = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(e) => {
            log::error!(
                "Error while downloading firmware at URL {}: {}",
                firmware_zip_url,
                e.to_string()
            );

            return Err(format!(
                "Error while downloading firmware at URL {}: {}",
                firmware_zip_url, e
            ));
        }
    };

    log::info!("Successfully downloaded {} bytes", bytes.len());

    Ok(bytes)
}
