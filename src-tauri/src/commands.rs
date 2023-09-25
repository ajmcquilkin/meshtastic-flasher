use espflash::flasher::ProgressCallbacks;
use espflash::{flasher::Flasher, interface::Interface};
use reqwest;
use serialport::SerialPortInfo;
use std::{
    io::{Cursor, Read},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use tokio::{fs::File, io::AsyncWriteExt};
use zip::read::ZipArchive;

use crate::state;

pub mod api {
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
}

#[tauri::command]
pub async fn fetch_firmware_releases(
    firmware_releases_state: tauri::State<'_, state::FirmwareReleasesState>,
) -> Result<api::firmware::ListFirmwareResponse, String> {
    log::info!("Called \"fetch_firmware_releases\" command with no args");

    let response =
        match reqwest::get(format!("{}/github/firmware/list", api::MESHTASTIC_API_URL)).await {
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

    let list_firmware_response: api::firmware::ListFirmwareResponse =
        serde_json::from_str(&response_text).map_err(|e| e.to_string())?;

    {
        let mut firmware_releases_guard = firmware_releases_state.inner.lock().await;
        *firmware_releases_guard = list_firmware_response.clone();
    }

    Ok(list_firmware_response)
}

#[tauri::command]
pub async fn fetch_supported_boards(
    boards_state: tauri::State<'_, state::BoardsState>,
) -> Result<api::boards::ListBoardsResponse, String> {
    log::info!("Called \"fetch_supported_boards\" command with no args");

    let response = match reqwest::get(format!(
        "{}/resource/deviceHardware",
        api::MESHTASTIC_API_URL
    ))
    .await
    {
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

    let boards_response: api::boards::ListBoardsResponse =
        match serde_json::from_str(&response_text) {
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

    {
        let mut boards_guard = boards_state.inner.lock().await;
        *boards_guard = boards_response.clone();
    }

    Ok(boards_response)
}

#[tauri::command]
pub async fn get_available_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    log::info!("Called \"get_available_serial_ports\" command with no args");

    match serialport::available_ports() {
        Ok(available_ports) => Ok(available_ports),
        Err(e) => {
            log::error!("Error while getting available ports: {}", e);
            Err(format!("Error while getting available ports: {}", e))
        }
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareVersion {
    major_version: u32,
    minor_version: u32,
    patch_version: u32,
    version_hash: String,
}

#[tauri::command]
pub async fn flash_device(
    app_handle: tauri::AppHandle,
    firmware_releases_state: tauri::State<'_, state::FirmwareReleasesState>,
    boards_state: tauri::State<'_, state::BoardsState>,
    hw_model: u32,
    firmware_version_id: String,
    upload_port: String,
) -> Result<(), String> {
    log::info!("Called \"flash_device\" command with args: hw_model: {}, firmware_version_id: {}, upload_port: {}", hw_model, firmware_version_id, upload_port);

    let firmware_releases_guard = firmware_releases_state.inner.lock().await;
    let boards_guard = boards_state.inner.lock().await;

    let board = match boards_guard.iter().find(|b| b.hw_model == hw_model) {
        Some(board) => board.to_owned(),
        None => {
            log::error!("Board with hardware model {} not found", hw_model);
            return Err(format!("Board with hardware model {} not found", hw_model));
        }
    };

    let stable_firmware_release = firmware_releases_guard
        .releases
        .stable
        .iter()
        .find(|r| r.id == firmware_version_id);

    let alpha_firmware_release = firmware_releases_guard
        .releases
        .alpha
        .iter()
        .find(|r| r.id == firmware_version_id);

    let firmware_release = match (stable_firmware_release, alpha_firmware_release) {
        (Some(stable), _) => stable,
        (_, Some(alpha)) => alpha,
        (None, None) => {
            log::error!(
                "Firmware release {} not found in stable or alpha channels",
                firmware_version_id
            );

            return Err(format!(
                "Firmware release {} not found in stable or alpha channels",
                firmware_version_id
            ));
        }
    };

    log::info!("Using board: {:?}", board);
    log::info!("Using firmware release: {:?}", firmware_release);

    let firmware_url = firmware_release.zip_url.clone();

    // Parse firmware string to get relevant info

    let re = match regex::Regex::new("(?:v?)(\\d+)\\.(\\d+)\\.(\\d+)(?:\\.([a-f0-9]+|[a-z\\-]+))?")
    {
        Ok(re) => re,
        Err(e) => {
            log::error!(
                "Error while parsing firmware version regex: {}",
                e.to_string()
            );

            return Err(format!("Error while parsing firmware version regex: {}", e));
        }
    };

    let captures = match re.captures(&firmware_version_id) {
        Some(captures) => {
            log::info!("Captures: {:?}", captures);
            captures
        }
        None => {
            log::error!("Found malformed firmware version {}", firmware_version_id);

            return Err(format!(
                "Found malformed firmware version {}",
                firmware_version_id
            ));
        }
    };

    let major_version = match captures
        .get(1)
        .ok_or("No major version found")?
        .as_str()
        .parse::<u32>()
    {
        Ok(major) => major,
        Err(e) => {
            log::error!("Error while parsing major version: {}", e.to_string());
            return Err(format!("Error while parsing major version: {}", e));
        }
    };

    let minor_version = match captures
        .get(2)
        .ok_or("No minor version found")?
        .as_str()
        .parse::<u32>()
    {
        Ok(minor) => minor,
        Err(e) => {
            log::error!("Error while parsing minor version: {}", e.to_string());
            return Err(format!("Error while parsing minor version: {}", e));
        }
    };

    let patch_version = match captures
        .get(3)
        .ok_or("No patch version found")?
        .as_str()
        .parse::<u32>()
    {
        Ok(patch) => patch,
        Err(e) => {
            log::error!("Error while parsing patch version: {}", e.to_string());
            return Err(format!("Error while parsing patch version: {}", e));
        }
    };

    let version_hash = match captures.get(4) {
        Some(hash) => hash.as_str().to_string(),
        None => {
            log::error!("No version hash found");
            return Err("No version hash found".to_string());
        }
    };

    let firmware_version = FirmwareVersion {
        major_version,
        minor_version,
        patch_version,
        version_hash,
    };

    log::info!("Using firmware version: {:?}", firmware_version);
    log::info!("Downloading firmware from {}", firmware_url.clone());

    // Download file from the URL
    let response = match reqwest::get(firmware_url.clone()).await {
        Ok(response) => response,
        Err(e) => {
            log::error!(
                "Error while building response for downloading firmware at URL {}: {}",
                firmware_url,
                e.to_string()
            );

            return Err(format!(
                "Error while building response for downloading firmware: {}",
                e
            ));
        }
    };

    log::info!(
        "Successfully created request to fetch firmware version {:?}",
        firmware_version
    );

    let bytes = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(e) => {
            log::error!(
                "Error while downloading firmware at URL {}: {}",
                firmware_url,
                e.to_string()
            );

            return Err(format!(
                "Error while downloading firmware at URL {}: {}",
                firmware_url, e
            ));
        }
    };

    log::info!("Successfully downloaded {} bytes", bytes.len());

    // Write firmware file to disk

    let path_resolver = app_handle.path();
    let app_data_dir = match path_resolver.app_data_dir() {
        Ok(app_data_dir) => app_data_dir,
        Err(e) => {
            log::error!(
                "Error while resolving app data directory: {}",
                e.to_string()
            );

            return Err(format!("Error while resolving app data directory: {}", e));
        }
    };

    log::info!("Found app data dir at location {}", app_data_dir.display());
    let firmware_directory = app_data_dir.join("firmware");

    if !firmware_directory.exists() {
        let new_firmware_directory = app_data_dir.join(Path::new("firmware"));

        log::info!(
            "Creating firmware directory at {}",
            new_firmware_directory.display()
        );

        match tokio::fs::create_dir(new_firmware_directory).await {
            Ok(_) => (),
            Err(e) => {
                log::error!("Error while creating firmware directory: {}", e.to_string());

                return Err(format!("Error while creating firmware directory: {}", e));
            }
        };
    }

    log::info!(
        "Using firmware directory at {}",
        firmware_directory.display()
    );

    let reader = Cursor::new(bytes);
    let mut archive = match ZipArchive::new(reader) {
        Ok(archive) => archive,
        Err(e) => {
            log::error!("Error while parsing firmware archive: {}", e.to_string());

            return Err(format!("Error while parsing firmware archive: {}", e));
        }
    };

    let firmware_file_name = if board.architecture.contains("esp") {
        get_esp_firmware_name(board.hw_model_slug.clone(), firmware_version)
    } else {
        // This will fail with a pico board
        get_nrf_firmware_name(board.hw_model_slug.clone(), firmware_version)
    };

    log::info!("Built firmware file name: {}", firmware_file_name);

    let temp_firmware_file = firmware_directory.join(firmware_file_name.clone());
    log::info!(
        "Will place firmware file at {}",
        temp_firmware_file.display()
    );

    // Need to keep `file` within scope since `ZipFile` isn't `Send`
    // This means it can't be awaited across
    let contents: Vec<u8> = {
        let mut file = match archive.by_name(firmware_file_name.as_str()) {
            Ok(file) => file,
            Err(e) => {
                log::error!("File {} not found in archive: {}", firmware_file_name, e);

                return Err(format!(
                    "File {} not found in archive: {}",
                    firmware_file_name, e
                ));
            }
        };

        // Read the file's contents and write them to the output

        let mut contents = Vec::new();
        match file.read_to_end(&mut contents) {
            Ok(_) => (),
            Err(e) => {
                log::error!(
                    "Error while reading firmware file from archive: {}",
                    e.to_string()
                );

                return Err(format!(
                    "Error while reading firmware file from archive: {}",
                    e
                ));
            }
        };

        contents
    };

    // Write firmware file to temp directory

    let temp_file_path = match path_resolver.temp_dir() {
        Ok(temp_dir) => temp_dir.join(firmware_file_name.clone()),
        Err(e) => {
            log::error!("Error while resolving temp directory: {}", e.to_string());

            return Err(format!("Error while resolving temp directory: {}", e));
        }
    };

    let mut output = match File::create(temp_file_path.clone()).await {
        Ok(output) => output,
        Err(e) => {
            log::error!(
                "Error while creating output firmware file at {}: {}",
                temp_file_path.display(),
                e.to_string()
            );

            return Err(format!(
                "Error while creating output firmware file at {}: {}",
                temp_file_path.display(),
                e
            ));
        }
    };

    match output.write_all(&contents).await {
        Ok(_) => (),
        Err(e) => {
            log::error!(
                "Error while writing firmware file to {}: {}",
                temp_file_path.display(),
                e.to_string()
            );

            return Err(format!(
                "Error while writing firmware file to {}: {}",
                temp_file_path.display(),
                e
            ));
        }
    };

    log::info!("Wrote firmware file to {}", temp_firmware_file.display());

    // Flash board

    if board.architecture.contains("esp") {
        flash_esp32(
            app_handle,
            firmware_file_name,
            temp_file_path.clone(),
            upload_port,
        )
        .await?;
    } else {
        flash_nrf(firmware_file_name, temp_file_path, upload_port).await?;
    }

    log::info!("Successfully flashed firmware");

    Ok(())
}

fn get_esp_firmware_name(slug: String, firmware_version: FirmwareVersion) -> String {
    format!(
        "firmware-{}-{}.{}.{}.{}.bin",
        slug.to_lowercase(),
        firmware_version.major_version,
        firmware_version.minor_version,
        firmware_version.patch_version,
        firmware_version.version_hash
    )
}

fn get_nrf_firmware_name(slug: String, firmware_version: FirmwareVersion) -> String {
    format!(
        "firmware-{}-{}.{}.{}.{}.uf2",
        slug.to_lowercase(),
        firmware_version.major_version,
        firmware_version.minor_version,
        firmware_version.patch_version,
        firmware_version.version_hash
    )
}

/// Adapted from @thebentern https://github.com/meshtastic/install/tree/main
#[derive(Clone, Debug)]
struct FlashProgress {
    current: usize,
    total: usize,
    app_handle: AppHandle,
    board_id: BoardId,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct BoardId(String);

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct FlashStatusUpdate {
    board_id: BoardId,
    current: usize,
    total: usize,
}

/// Adapted from @thebentern https://github.com/meshtastic/install/tree/main
impl ProgressCallbacks for FlashProgress {
    fn init(&mut self, addr: u32, total: usize) {
        log::info!(
            "Initializing flash progress with addr: {}, total: {}",
            addr,
            total
        );
        self.current = 0;
        self.total = total;
    }

    fn update(&mut self, current: usize) {
        log::info!("Updating flash progress with current: {}", current);
        self.current = current;

        match self.app_handle.emit_all(
            format!("flash-status-update-{}", self.board_id.0).as_str(),
            FlashStatusUpdate {
                board_id: self.board_id.clone(),
                current,
                total: self.total,
            },
        ) {
            Ok(_) => (),
            Err(e) => {
                log::error!("Error while emitting flash status update: {}", e);
                panic!("Error while emitting flash status update");
            }
        };
    }

    fn finish(&mut self) {
        log::info!("Successfully flashed firmware");
    }
}

/// Adapted from @thebentern https://github.com/meshtastic/install/tree/main
pub fn get_port_by_name(port: &String) -> Result<serialport::SerialPortInfo, String> {
    log::info!("Getting port by name: {}", port);

    let available_ports = match serialport::available_ports() {
        Ok(available_ports) => available_ports,
        Err(e) => {
            log::error!("Error while getting available ports: {}", e);
            return Err(format!("Error while getting available ports: {}", e));
        }
    };

    log::debug!("Available ports: {:?}", available_ports);

    let port_info = match available_ports.into_iter().find(|p| {
        match &p.port_type {
            serialport::SerialPortType::UsbPort(_info) if p.port_name == port.as_str() => {
                return true;
            }
            _ => (),
        }
        false
    }) {
        Some(port_info) => port_info,
        None => {
            log::error!("Port {} not found", port);
            return Err(format!("Port {} not found", port));
        }
    };

    Ok(port_info)
}

/// Adapted from @thebentern https://github.com/meshtastic/install/tree/main
pub async fn flash_esp_binary(
    app_handle: tauri::AppHandle,
    port: String,
    binary_file_path: PathBuf,
    flash_offset: u32,
) -> Result<(), String> {
    let mut data = match tokio::fs::read(&binary_file_path).await {
        Ok(data) => data,
        Err(e) => {
            log::error!(
                "Error while reading firmware file at {}: {}",
                binary_file_path.display(),
                e.to_string()
            );

            return Err(format!(
                "Error while reading firmware file at {}: {}",
                binary_file_path.display(),
                e
            ));
        }
    };

    let dtr = Some(1);
    let rts = Some(0);

    // let port_info = get_serial_port_info(port.as_str()).unwrap();
    let serial_port_info = get_port_by_name(&port)?;
    let port_info = match &serial_port_info.port_type {
        serialport::SerialPortType::UsbPort(info) => info.clone(),
        _ => {
            log::error!("Specified port is not a valid USB / Serial port");
            return Err("Specified port is not a valid USB / Serial port".to_string());
        }
    };

    let serial = match Interface::new(&serial_port_info, dtr, rts) {
        Ok(serial) => serial,
        Err(e) => {
            log::error!(
                "Error while creating serial interface with info {:?}, dtr {:?}, rts {:?}: {}",
                serial_port_info,
                dtr,
                rts,
                e
            );

            return Err(format!(
                "Error while creating serial interface with info {:?}, dtr {:?}, rts {:?}: {}",
                serial_port_info, dtr, rts, e
            ));
        }
    };

    log::info!("Connecting to port {}...", port);

    // ? Why this speed?
    let mut flasher = match Flasher::connect(serial, port_info, Some(921600), true) {
        Ok(flasher) => flasher,
        Err(e) => {
            log::error!("Error while connecting to port {}: {}", port, e);
            return Err(format!("Error while connecting to port {}: {}", port, e));
        }
    };

    log::info!("Starting flashing process...");

    let chunk_size = 1024 * 1024; // 1MB chunk size
    let mut offset = flash_offset;

    let mut progress = FlashProgress {
        total: 0,
        current: 0,
        app_handle,
        board_id: BoardId(port.clone()),
    };

    while !data.is_empty() {
        let (chunk, rest) = if data.len() > chunk_size {
            data.split_at(chunk_size)
        } else {
            (data.as_ref(), &[][..])
        };

        match flasher.write_bin_to_flash(offset, chunk, Some(&mut progress)) {
            Ok(_) => (),
            Err(e) => {
                log::error!("Error while flashing firmware: {}", e);
                return Err(format!("Error while flashing firmware: {}", e));
            }
        };

        offset += chunk.len() as u32;
        data = rest.to_vec();
    }
    Ok(())
}

async fn flash_esp32(
    app_handle: tauri::AppHandle,
    firmware_file_name: String,
    firmware_file_path: PathBuf,
    upload_port: String,
) -> Result<(), String> {
    log::info!(
        "ESP32 board detected, will use file: {} -> {}",
        firmware_file_name,
        upload_port
    );

    flash_esp_binary(app_handle, upload_port, firmware_file_path, 0x010000).await?;

    Ok(())
}

async fn flash_nrf(
    firmware_file_name: String,
    firmware_file_path: PathBuf,
    upload_dir: String,
) -> Result<(), String> {
    log::info!(
        "Non-ESP32 board detected, will use file: {} -> {}",
        firmware_file_name,
        upload_dir
    );

    // Open temporary firmware file

    let firmware_file = match File::open(firmware_file_path.clone()).await {
        Ok(firmware_file) => firmware_file,
        Err(e) => {
            log::error!(
                "Error while opening firmware file at {}: {}",
                firmware_file_path.display(),
                e.to_string()
            );

            return Err(format!(
                "Error while opening firmware file at {}: {}",
                firmware_file_path.display(),
                e
            ));
        }
    };

    log::info!("Opened firmware file at {}", firmware_file_path.display());

    // Create output file

    let output_file_path = Path::new(&upload_dir).join(firmware_file_name);

    log::info!("Output file path: {}", output_file_path.display());

    let output_file = match File::create(output_file_path.clone()).await {
        Ok(output_file) => output_file,
        Err(e) => {
            log::error!(
                "Error while creating output file at {}: {}",
                output_file_path.display(),
                e.to_string()
            );

            return Err(format!(
                "Error while creating output file at {}: {}",
                output_file_path.display(),
                e
            ));
        }
    };

    log::info!("Opened output file at {}", output_file_path.display());

    // Write contents of firmware file to output file

    let mut firmware_file_reader = tokio::io::BufReader::new(firmware_file);

    log::info!("Created firmware file reader");

    let mut output_file_writer = tokio::io::BufWriter::new(output_file);

    log::info!("Created output file writer");

    match tokio::io::copy(&mut firmware_file_reader, &mut output_file_writer).await {
        Ok(_) => (),
        Err(e) => {
            log::error!(
                "Error while copying firmware file to output file at {}: {}",
                output_file_path.display(),
                e.to_string()
            );

            return Err(format!(
                "Error while copying firmware file to output file at {}: {}",
                output_file_path.display(),
                e
            ));
        }
    };

    log::info!("Wrote firmware file to {}", output_file_path.display());

    Ok(())
}
