use serialport::SerialPortInfo;

use crate::api::boards::Board;
use crate::api::firmware::FirmwareRelease;
use crate::flasher::{self, parse_firmware_version};
use crate::fs::{
    create_archive_from_bytes, extract_binary_from_archive, get_firmware_file_name,
    get_temp_file_path, write_binary_to_temp_file,
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

    // Use and unlock boards mutex
    let board: Board = {
        let boards_guard = boards_state.inner.lock().await;

        match boards_guard.iter().find(|b| b.hw_model == hw_model) {
            Some(board) => board.clone(),
            None => {
                log::error!("Board with hardware model {} not found", hw_model);
                return Err(format!("Board with hardware model {} not found", hw_model));
            }
        }
    };

    log::info!("Using board: {:?}", board);

    // Use and unlock releases mutex
    let firmware_release: FirmwareRelease = {
        let firmware_releases_guard = firmware_releases_state.inner.lock().await;

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

        match (stable_firmware_release, alpha_firmware_release) {
            (Some(stable), _) => stable.clone(),
            (_, Some(alpha)) => alpha.clone(),
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
        }
    };

    log::info!("Using firmware release: {:?}", firmware_release);

    // Process information from mutexes

    let firmware_zip_url = firmware_release.zip_url.clone();
    let parsed_firmware_version = parse_firmware_version(&firmware_version_id)?;

    log::info!("Using firmware version: {:?}", parsed_firmware_version);

    let firmware_zip_bundle_bytes = api::fetch_firmware_bundle(firmware_zip_url.clone()).await?;

    // Write firmware file to disk

    let firmware_file_name = get_firmware_file_name(&board, &parsed_firmware_version)?;

    // Only relevant to ESP32 variants
    let ble_ota_binary_name: String = if board.architecture.contains("esp32-s3") {
        "bleota-s3.bin".to_string()
    } else {
        "bleota.bin".to_string()
    };

    // Only relevant to ESP32 variants
    let littlefs_binary_name: String = format!(
        "littlefs-{}.{}.{}.{}.bin",
        parsed_firmware_version.major_version,
        parsed_firmware_version.minor_version,
        parsed_firmware_version.patch_version,
        parsed_firmware_version.version_hash
    );

    let temp_firmware_file_path = get_temp_file_path(&app_handle, firmware_file_name.clone())?;
    let temp_ble_ota_file_path = get_temp_file_path(&app_handle, ble_ota_binary_name.clone())?;
    let temp_littlefs_file_path = get_temp_file_path(&app_handle, littlefs_binary_name.clone())?;

    let mut archive = create_archive_from_bytes(firmware_zip_bundle_bytes).await?;

    let firmware_binary_contents =
        extract_binary_from_archive(&mut archive, &firmware_file_name).await?;

    // Only relevant to ESP32 variants
    let ble_ota_binary_contents =
        extract_binary_from_archive(&mut archive, &ble_ota_binary_name).await?;

    // Only relevant to ESP32 variants
    let littlefs_binary_contents =
        extract_binary_from_archive(&mut archive, &littlefs_binary_name).await?;

    // Write files to temp directory

    write_binary_to_temp_file(temp_firmware_file_path.clone(), firmware_binary_contents).await?;
    write_binary_to_temp_file(temp_ble_ota_file_path.clone(), ble_ota_binary_contents).await?;
    write_binary_to_temp_file(temp_littlefs_file_path.clone(), littlefs_binary_contents).await?;

    // Flash board

    flasher::flash_board(
        app_handle,
        temp_firmware_file_path,
        temp_ble_ota_file_path,
        temp_littlefs_file_path,
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
