use serialport::SerialPortInfo;

use crate::flasher::{self, parse_firmware_version};
use crate::fs::{
    extract_binary_from_archive, get_firmware_file_name, get_temp_file_path,
    write_binary_to_temp_file,
};
use crate::{api, state};

#[tauri::command]
pub async fn fetch_firmware_releases(
    firmware_releases_state: tauri::State<'_, state::FirmwareReleasesState>,
) -> Result<api::firmware::ListFirmwareResponse, String> {
    log::info!("Called \"fetch_firmware_releases\" command with no args");

    let list_firmware_response = api::fetch_firmware_releases().await?;

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

    let boards_response = api::fetch_supported_boards().await?;

    {
        let mut boards_guard = boards_state.inner.lock().await;
        *boards_guard = boards_response.clone();
    }

    Ok(boards_response)
}

#[tauri::command]
pub async fn get_available_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    log::info!("Called \"get_available_serial_ports\" command with no args");

    let available_ports = match serialport::available_ports() {
        Ok(available_ports) => available_ports,
        Err(e) => {
            log::error!("Error while getting available ports: {}", e);
            return Err(format!("Error while getting available ports: {}", e));
        }
    };

    Ok(available_ports)
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

    let firmware_zip_url = firmware_release.zip_url.clone();
    let parsed_firmware_version = parse_firmware_version(&firmware_version_id)?;

    log::info!("Using firmware version: {:?}", parsed_firmware_version);

    let firmware_zip_bundle_bytes = api::fetch_firmware_bundle(firmware_zip_url.clone()).await?;

    // Write firmware file to disk

    let firmware_file_name = get_firmware_file_name(&board, &parsed_firmware_version)?;

    let contents: Vec<u8> =
        extract_binary_from_archive(&firmware_file_name, firmware_zip_bundle_bytes).await?;

    // Write firmware file to temp directory

    let temp_file_path = get_temp_file_path(&app_handle, firmware_file_name.clone())?;

    write_binary_to_temp_file(temp_file_path.clone(), contents).await?;

    // Flash board

    flasher::flash_board(
        app_handle,
        temp_file_path,
        firmware_file_name,
        upload_port,
        board,
    )
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn quit_application(app_handle: tauri::AppHandle) -> Result<(), String> {
    log::info!("Called \"quit_application\" command with no args");

    app_handle.exit(0);

    Ok(())
}
