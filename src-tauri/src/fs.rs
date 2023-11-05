use std::{
    io::{Cursor, Read},
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager};
use tokio::{fs::File, io::AsyncWriteExt};
use zip::ZipArchive;

use crate::{api, flasher::FirmwareVersion};

pub async fn create_or_locate_firmware_directory(
    app_handle: &AppHandle,
) -> Result<PathBuf, String> {
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

        match tokio::fs::create_dir_all(new_firmware_directory).await {
            Ok(_) => (),
            Err(e) => {
                log::error!("Error while creating firmware directory: {}", e.to_string());

                return Err(format!("Error while creating firmware directory: {}", e));
            }
        };
    }

    Ok(firmware_directory)
}

pub fn get_firmware_file_name(
    board: &api::boards::Board,
    parsed_firmware_version: &FirmwareVersion,
) -> Result<String, String> {
    let firmware_file_name = if board.architecture.contains("esp") {
        get_esp_firmware_name(&board.platformio_target, parsed_firmware_version)
    } else if board.architecture.contains("nrf") {
        get_nrf_firmware_name(&board.platformio_target, parsed_firmware_version)
    } else if board.architecture.contains("pico") {
        get_pico_firmware_name(&board.platformio_target, parsed_firmware_version)
    } else {
        log::error!("Unsupported architecture: {}", board.architecture);
        return Err(format!("Unsupported architecture: {}", board.architecture));
    };

    log::info!("Built firmware file name: {}", firmware_file_name);

    Ok(firmware_file_name)
}

pub async fn create_archive_from_bytes(
    firmware_zip_bundle_bytes: bytes::Bytes,
) -> Result<ZipArchive<Cursor<bytes::Bytes>>, String> {
    let reader = Cursor::new(firmware_zip_bundle_bytes);

    let archive = match ZipArchive::new(reader) {
        Ok(archive) => archive,
        Err(e) => {
            log::error!("Error while parsing firmware archive: {}", e.to_string());
            return Err(format!("Error while parsing firmware archive: {}", e));
        }
    };

    Ok(archive)
}

pub async fn extract_binary_from_archive(
    archive: &mut ZipArchive<Cursor<bytes::Bytes>>,
    firmware_file_name: &String,
) -> Result<Vec<u8>, String> {
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

    Ok(contents)
}

fn get_esp_firmware_name(slug: &String, firmware_version: &FirmwareVersion) -> String {
    format!(
        "firmware-{}-{}.{}.{}.{}.bin",
        slug.to_lowercase(),
        firmware_version.major_version,
        firmware_version.minor_version,
        firmware_version.patch_version,
        firmware_version.version_hash
    )
}

fn get_nrf_firmware_name(slug: &String, firmware_version: &FirmwareVersion) -> String {
    format!(
        "firmware-{}-{}.{}.{}.{}.uf2",
        slug.to_lowercase(),
        firmware_version.major_version,
        firmware_version.minor_version,
        firmware_version.patch_version,
        firmware_version.version_hash
    )
}

fn get_pico_firmware_name(slug: &String, firmware_version: &FirmwareVersion) -> String {
    format!(
        "firmware-{}-{}.{}.{}.{}.uf2",
        slug.to_lowercase(),
        firmware_version.major_version,
        firmware_version.minor_version,
        firmware_version.patch_version,
        firmware_version.version_hash
    )
}

// ? Is it a problem to write into the general temp directory?
pub fn get_temp_file_path(
    app_handle: &AppHandle,
    firmware_file_name: String,
) -> Result<PathBuf, String> {
    let path_resolver = app_handle.path();

    let temp_file_path = match path_resolver.temp_dir() {
        Ok(temp_dir) => temp_dir.join(firmware_file_name.clone()),
        Err(e) => {
            log::error!("Error while resolving temp directory: {}", e.to_string());

            return Err(format!("Error while resolving temp directory: {}", e));
        }
    };

    Ok(temp_file_path)
}

pub async fn write_binary_to_temp_file(
    temp_file_path: PathBuf,
    contents: Vec<u8>,
) -> Result<(), String> {
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

    log::info!("Wrote firmware file to {}", temp_file_path.display());

    Ok(())
}
