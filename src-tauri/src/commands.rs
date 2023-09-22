use espflash::flasher::ProgressCallbacks;
use espflash::{flasher::Flasher, interface::Interface};
use reqwest;
use serialport::SerialPortInfo;
use std::{
    io::{Cursor, Read},
    path::{Path, PathBuf},
};
use tauri::Manager;
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
    let response = reqwest::get(format!("{}/github/firmware/list", api::MESHTASTIC_API_URL))
        .await
        .map_err(|e| e.to_string())?;

    let response_text = response.text().await.map_err(|e| e.to_string())?;

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
    let response = reqwest::get(format!(
        "{}/resource/deviceHardware",
        api::MESHTASTIC_API_URL
    ))
    .await
    .map_err(|e| e.to_string())?;

    let response_text = response.text().await.map_err(|e| e.to_string())?;

    let boards_response: api::boards::ListBoardsResponse =
        serde_json::from_str(&response_text).map_err(|e| e.to_string())?;

    {
        let mut boards_guard = boards_state.inner.lock().await;
        *boards_guard = boards_response.clone();
    }

    Ok(boards_response)
}

#[tauri::command]
pub async fn get_available_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    serialport::available_ports().map_err(|e| e.to_string())
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareVersion {
    major: u32,
    minor: u32,
    patch: u32,
    hash: String,
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
    let firmware_releases_guard = firmware_releases_state.inner.lock().await;
    let boards_guard = boards_state.inner.lock().await;

    println!("hw_model: {}", hw_model);
    println!("firmware_version_id: {}", firmware_version_id);
    println!("upload_port: {:?}", upload_port);

    let board = boards_guard
        .iter()
        .find(|b| b.hw_model == hw_model)
        .ok_or(format!("Board with hw_model {} not found", hw_model))?
        .clone();

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
            return Err(format!(
                "Firmware release {} not found",
                firmware_version_id
            ))
        }
    };

    println!("Board: {:?}", board);
    println!("Firmware release: {:?}", firmware_release);

    let firmware_url = firmware_release.zip_url.clone();

    // Parse firmware string to get relevant info

    let re = regex::Regex::new("(?:v?)(\\d+)\\.(\\d+)\\.(\\d+)(?:\\.([a-f0-9]+|[a-z\\-]+))?")
        .map_err(|e| e.to_string())?;

    let captures = re.captures(&firmware_version_id).ok_or("No captures")?;

    let firmware_version = FirmwareVersion {
        major: captures
            .get(1)
            .ok_or("No major")?
            .as_str()
            .parse::<u32>()
            .map_err(|e| e.to_string())?,

        minor: captures
            .get(2)
            .ok_or("No minor")?
            .as_str()
            .parse::<u32>()
            .map_err(|e| e.to_string())?,

        patch: captures
            .get(3)
            .ok_or("No patch")?
            .as_str()
            .parse::<u32>()
            .map_err(|e| e.to_string())?,

        hash: captures.get(4).ok_or("No hash")?.as_str().to_string(),
    };

    println!("Firmware version: {:?}", firmware_version);

    println!("Downloading firmware from {}", firmware_url.clone());

    // Download file from the URL
    let response = reqwest::get(firmware_url.clone())
        .await
        .map_err(|e| e.to_string())?;

    println!("Created GET request");

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    println!("Successfully downloaded {} bytes", bytes.len());

    // Write firmware file to disk

    let path_resolver = app_handle.path();
    let app_data_dir = path_resolver.app_data_dir().map_err(|e| e.to_string())?;

    println!("App data dir: {}", app_data_dir.display());

    if !Path::new(app_data_dir.join(Path::new("firmware")).as_path()).exists() {
        println!("Creating firmware directory");

        tokio::fs::create_dir(app_data_dir.join(Path::new("firmware")))
            .await
            .map_err(|e| e.to_string())?;
    }

    let firmware_directory = app_data_dir.join("firmware");

    println!("Firmware directory: {}", firmware_directory.display());

    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;

    let firmware_file_name = if board.architecture.contains("esp") {
        get_esp_firmware_name(board.hw_model_slug.clone(), firmware_version)
    } else {
        // This will fail with a pico board
        get_nrf_firmware_name(board.hw_model_slug.clone(), firmware_version)
    };
    println!("Firmware file name: {}", firmware_file_name);

    let temp_firmware_file = firmware_directory.join(firmware_file_name.clone());
    println!("Temp firmware file: {}", temp_firmware_file.display());

    // Need to keep `file` within scope since `ZipFile` isn't `Send`
    // This means it can't be awaited across
    let contents: Vec<u8> = {
        let mut file = match archive.by_name(firmware_file_name.as_str()) {
            Ok(file) => file,
            Err(e) => {
                return Err(format!(
                    "File {} not found in archive: {}",
                    firmware_file_name, e
                ))
            }
        };

        // Read the file's contents and write them to the output

        let mut contents = Vec::new();
        file.read_to_end(&mut contents).map_err(|e| e.to_string())?;

        contents
    };

    // Write firmware file to temp directory

    let temp_file_path = path_resolver
        .temp_dir()
        .map_err(|e| e.to_string())?
        .join(firmware_file_name.clone());

    let mut output = File::create(temp_file_path.clone())
        .await
        .map_err(|e| e.to_string())?;

    output
        .write_all(&contents)
        .await
        .map_err(|e| e.to_string())?;

    println!("Wrote firmware file to {}", temp_firmware_file.display());

    // Flash board

    if board.architecture.contains("esp") {
        flash_esp32(firmware_file_name, temp_file_path.clone(), upload_port).await?;
    // temp_firmware_path
    } else {
        flash_nrf(firmware_file_name, temp_file_path, upload_port).await?; // temp_firmware_path
    }

    Ok(())
}

fn get_esp_firmware_name(slug: String, firmware_version: FirmwareVersion) -> String {
    format!(
        "firmware-{}-{}.{}.{}.{}.bin",
        slug.to_lowercase(),
        firmware_version.major,
        firmware_version.minor,
        firmware_version.patch,
        firmware_version.hash
    )
}

fn get_nrf_firmware_name(slug: String, firmware_version: FirmwareVersion) -> String {
    format!(
        "firmware-{}-{}.{}.{}.{}.uf2",
        slug.to_lowercase(),
        firmware_version.major,
        firmware_version.minor,
        firmware_version.patch,
        firmware_version.hash
    )
}

/// Adapted from @thebentern https://github.com/meshtastic/install/tree/main
#[derive(Clone, Debug)]
struct FlashProgress {
    current: usize,
    total: usize,
}

/// Adapted from @thebentern https://github.com/meshtastic/install/tree/main
impl ProgressCallbacks for FlashProgress {
    fn init(&mut self, addr: u32, total: usize) {
        println!("init: addr: {}, total: {}", addr, total);
        self.current = 0;
        self.total = total;
    }

    fn update(&mut self, current: usize) {
        println!("update: current: {}", current);
        self.current = current;
    }

    fn finish(&mut self) {
        println!("finish");
    }
}

/// Adapted from @thebentern https://github.com/meshtastic/install/tree/main
pub fn get_port_by_name(port: &String) -> Result<serialport::SerialPortInfo, String> {
    let port_info = serialport::available_ports()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|p| {
            match &p.port_type {
                serialport::SerialPortType::UsbPort(_info) if p.port_name == port.as_str() => {
                    return true;
                }
                _ => (),
            }
            false
        })
        .ok_or(format!("Port {} not found", port))?;

    Ok(port_info)
}

/// Adapted from @thebentern https://github.com/meshtastic/install/tree/main
pub async fn flash_esp_binary(
    port: String,
    binary_file_path: PathBuf,
    flash_offset: u32,
) -> Result<(), String> {
    let mut data = tokio::fs::read(&binary_file_path)
        .await
        .map_err(|e| e.to_string())?;

    let dtr = Some(1);
    let rts = Some(0);

    // let port_info = get_serial_port_info(port.as_str()).unwrap();
    let serial_port_info = get_port_by_name(&port)?;
    let port_info = match &serial_port_info.port_type {
        serialport::SerialPortType::UsbPort(info) => Some(info.clone()),
        _ => return Err("Specified port is not a valid USB / Serial port".to_string()),
    };
    let serial = Interface::new(&serial_port_info, dtr, rts).unwrap();

    println!("Connecting to port {}...", port);
    let mut flasher = Flasher::connect(serial, port_info.unwrap(), Some(921600), true)
        .map_err(|e| e.to_string())?;

    println!("Starting flashing process...");

    let chunk_size = 1024 * 1024; // 1MB chunk size
    let mut offset = flash_offset;

    let mut progress = FlashProgress {
        total: 0,
        current: 0,
    };

    while !data.is_empty() {
        let (chunk, rest) = if data.len() > chunk_size {
            data.split_at(chunk_size)
        } else {
            (data.as_ref(), &[][..])
        };

        flasher
            .write_bin_to_flash(offset, chunk, Some(&mut progress))
            .map_err(|e| {
                let error = format!("Flash error: {:?}", e);
                println!("{}", error);
                error
            })?;

        offset += chunk.len() as u32;
        data = rest.to_vec();
    }
    Ok(())
}

async fn flash_esp32(
    firmware_file_name: String,
    firmware_file_path: PathBuf,
    upload_port: String,
) -> Result<(), String> {
    println!(
        "ESP32 board detected, will use file: {} -> {}/{}",
        firmware_file_name, upload_port, firmware_file_name
    );

    flash_esp_binary(upload_port, firmware_file_path, 0x010000).await?;

    Ok(())
}

async fn flash_nrf(
    firmware_file_name: String,
    firmware_file_path: PathBuf,
    upload_dir: String,
) -> Result<(), String> {
    println!(
        "Non-ESP32 board detected, will use file: {} -> {}",
        firmware_file_name, upload_dir
    );

    // Open temporary firmware file

    let firmware_file = File::open(firmware_file_path.clone())
        .await
        .map_err(|e| e.to_string())?;

    println!("Opened firmware file at {}", firmware_file_path.display());

    // Create output file

    let output_file_path = Path::new(&upload_dir).join(firmware_file_name);

    println!("Output file path: {}", output_file_path.display());

    let output_file = File::create(output_file_path.clone())
        .await
        .map_err(|e| e.to_string())?;

    println!("Opened output file at {}", output_file_path.display());

    // Write contents of firmware file to output file

    let mut firmware_file_reader = tokio::io::BufReader::new(firmware_file);

    println!("Created firmware file reader");

    let mut output_file_writer = tokio::io::BufWriter::new(output_file);

    println!("Created output file writer");

    tokio::io::copy(&mut firmware_file_reader, &mut output_file_writer)
        .await
        .map_err(|e| e.to_string())?;

    println!("Wrote firmware file to {}", output_file_path.display());

    Ok(())
}
