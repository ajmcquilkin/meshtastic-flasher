use reqwest;
use serialport::SerialPortInfo;
use std::io::{Cursor, Read};
use tauri::{api::path::app_data_dir, Config};
use tokio::{fs::File, io::BufReader};
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
#[serde(tag = "type", content = "port", rename_all = "camelCase")]
pub enum UploadPort {
    SerialPort(String), // e.g. "COM1"
    LocalDisk(String),  // e.g. "D:\"
}

#[tauri::command]
pub async fn flash_device(
    app_handle: tauri::AppHandle,
    firmware_releases_state: tauri::State<'_, state::FirmwareReleasesState>,
    boards_state: tauri::State<'_, state::BoardsState>,
    hw_model: u32,
    firmware_version: String,
    upload_port: UploadPort,
) -> Result<(), String> {
    let firmware_releases_guard = firmware_releases_state.inner.lock().await;
    let boards_guard = boards_state.inner.lock().await;

    println!("hw_model: {}", hw_model);
    println!("firmware_version: {}", firmware_version);
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
        .find(|r| r.id == firmware_version);

    let alpha_firmware_release = firmware_releases_guard
        .releases
        .alpha
        .iter()
        .find(|r| r.id == firmware_version);

    let firmware_release = match (stable_firmware_release, alpha_firmware_release) {
        (Some(stable), _) => stable,
        (_, Some(alpha)) => alpha,
        (None, None) => return Err(format!("Firmware release {} not found", firmware_version)),
    };

    println!("Board: {:?}", board);
    println!("Firmware release: {:?}", firmware_release);

    let firmware_url = firmware_release.zip_url.clone();

    // Download file from the URL
    let response = reqwest::get(firmware_url.clone())
        .await
        .map_err(|e| e.to_string())?;

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    // Create a cursor to read the downloaded data and pass it to the ZipArchive
    let reader = Cursor::new(bytes.clone());
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;

    // Loop through each file in the ZIP

    let mut firmware_file = None;
    let mut firmware_file_name = None;

    for i in 0..archive.len() {
        let mut file = &archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = file.name().to_owned();

        println!("Filename: {}", outpath);

        if outpath.contains(board.hw_model_slug.as_str()) {
            firmware_file = Some(file);
            firmware_file_name = Some(outpath);
            break;
        }
    }

    // get selected files and write them to disk

    let mut firmware_file = firmware_file.ok_or("No firmware file found".to_string())?;
    let mut firmware_file_name =
        firmware_file_name.ok_or("No firmware file name found".to_string())?;

    println!("Firmware file: {}", firmware_file_name);

    let app_data_dir = app_data_dir(&app_handle.config()).ok_or("No app data dir".to_string())?;
    let firmware_directory = app_data_dir.join("firmware");

    // TODO unzip the archive file
    // std::fs::create_dir(firmware_directory.clone()).map_err(|e| e.to_string())?;

    // let mut outfile = std::fs::File::create(firmware_directory.join(firmware_file_name.clone()))
    //     .map_err(|e| e.to_string())?;

    // // unzip the files before copying

    // let file = File::open(firmware_file).await.map_err(|e| e.to_string())?;
    // let mut archive = ZipArchive::new(BufReader::new(file)).map_err(|e| e.to_string())?;

    // let mut zip_file = archive.by_name(file_name).map_err(|e| e.to_string())?;

    // let mut output_file = File::create(output_path).map_err(|e| e.to_string())?;

    // std::io::copy(&mut zip_file, &mut output_file).map_err(|e| e.to_string())?;

    // std::io::copy(firmware_file, outfile).map_err(|e| e.to_string())?;

    if board.architecture.contains("esp") {
        flash_esp32().await?;
    } else {
        flash_nrf().await?;
    }

    Ok(())
}

async fn flash_esp32() -> Result<(), String> {
    println!(
        "ESP32 board detected, will use esptool-rs: {}",
        board.architecture
    );

    Ok(())
}

async fn flash_nrf() -> Result<(), String> {
    println!(
        "Non-ESP32 board detected, will use file: {}",
        board.architecture
    );

    Ok(())
}

// #[tauri::command]
// pub async fn download_release_assets(
//     app_handle: tauri::AppHandle,
//     firmware_releases_state: tauri::State<'_, state::FirmwareReleasesState>,
//     tag: String,
// ) -> Result<Vec<String>, String> {
//     // Don't want to block mutex for too long, and don't need
//     // to update the release metadata, so just clone it
//     let found_release = {
//         let firmware_releases_guard = firmware_releases_state.inner.lock().await;

//         firmware_releases_guard
//             .get(&tag)
//             .ok_or("Release not found".to_string())?
//             .clone()
//     };

//     println!(
//         "Found release: {:?}",
//         found_release
//             .assets
//             .clone()
//             .iter()
//             .map(|a| a.name.clone())
//             .collect::<Vec<_>>()
//     );

//     let firmware_asset = found_release
//         .assets
//         .iter()
//         .find(|asset| {
//             asset.name.ends_with(".zip") && asset.name.contains("firmware")
//             // && asset.name.contains(format!("firmware-{}", tag).as_str())
//         })
//         .ok_or(format!("No \"firmware\" asset found for release {}", tag))?;

//     println!(
//         "Downloading firmware from {}",
//         firmware_asset.browser_download_url
//     );

//     // Download the ZIP file
//     let response = reqwest::get(firmware_asset.browser_download_url.clone())
//         .await
//         .map_err(|e| e.to_string())?;
//     let bytes = response.bytes().await.map_err(|e| e.to_string())?;

//     println!("Downloaded {} bytes", bytes.len());

//     // Create a cursor to read the downloaded data and pass it to the ZipArchive
//     let reader = Cursor::new(bytes);
//     let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;

//     println!("Archive has {} files", archive.len());

//     let app_data_dir = app_data_dir(&app_handle.config()).ok_or("No app data dir".to_string())?;
//     println!("App data dir: {}", app_data_dir.display());
//     let firmware_directory = app_data_dir.join("firmware");
//     std::fs::create_dir(firmware_directory.clone()).map_err(|e| e.to_string())?;

//     // Loop through each file in the ZIP
//     for i in 0..archive.len() {
//         let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
//         let outpath = firmware_directory.clone().join(file.name());

//         println!("Filename: {}", outpath.display());

//         // if file.name().ends_with('/') {
//         //     std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
//         // } else {
//         //     if let Some(p) = outpath.parent() {
//         //         if !p.exists() {
//         //             std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
//         //         }
//         //     }
//         //     let mut outfile = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
//         //     std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
//         // }
//     }

//     let mut boards = vec![];

//     for asset in &found_release.assets {
//         if asset.name.ends_with(".bin") {
//             boards.push(asset.name.clone());
//         }
//     }

//     Ok(boards)
// }
