use std::path::{Path, PathBuf};

use tauri::Manager;
use tokio::fs::File;

use crate::api::boards::Board;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareVersion {
    pub major_version: u32,
    pub minor_version: u32,
    pub patch_version: u32,
    pub version_hash: String,
}

pub fn parse_firmware_version(firmware_version_id: &String) -> Result<FirmwareVersion, String> {
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

    Ok(FirmwareVersion {
        major_version,
        minor_version,
        patch_version,
        version_hash,
    })
}

#[derive(Clone, Debug)]
struct FlashProgress {
    current: usize,
    total: usize,
    app_handle: tauri::AppHandle,
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

impl espflash::flasher::ProgressCallbacks for FlashProgress {
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
        log::info!("Successfully flashed firmware chunk");
    }
}

pub async fn flash_board(
    app_handle: tauri::AppHandle,
    temp_firmware_file_path: PathBuf,
    temp_ble_ota_file_path: PathBuf,  // ESP32 variants only
    temp_littlefs_file_path: PathBuf, // ESP32 variants only
    firmware_file_name: String,
    upload_port: String,
    board: Board,
) -> Result<(), String> {
    log::debug!("Flashing board with architecture {}", board.architecture);

    if board.architecture.contains("esp") {
        log::info!(
            "ESP32 board detected, will use firmware file: {} -> {}",
            firmware_file_name,
            upload_port
        );

        flash_esp32(
            app_handle,
            temp_firmware_file_path.clone(),
            temp_ble_ota_file_path,
            temp_littlefs_file_path,
            upload_port,
        )
        .await?;
    } else if board.architecture.contains("nrf") {
        log::info!(
            "NRF board detected, will use firmware file: {} -> {}",
            firmware_file_name,
            upload_port
        );

        flash_nrf(firmware_file_name, temp_firmware_file_path, upload_port).await?;
    } else if board.architecture.contains("rp2040") {
        log::info!(
            "Pico board detected, will use firmware file: {} -> {}",
            firmware_file_name,
            upload_port
        );

        flash_nrf(firmware_file_name, temp_firmware_file_path, upload_port).await?;
    } else {
        log::error!("Unsupported architecture: {}", board.architecture);
        return Err(format!("Unsupported architecture: {}", board.architecture));
    }

    log::info!("Successfully flashed firmware");

    Ok(())
}

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

pub async fn flash_esp_binary(
    app_handle: tauri::AppHandle,
    upload_port: String,
    flash_offset: u32,
    binary_file_path: PathBuf,
    reboot: bool,
) -> Result<(), String> {
    let serial_interface = init_esp32_serial_port(&upload_port).await?;
    let usb_port_info = get_serial_port_info(&upload_port).await?;

    let mut binary_data_buffer = match tokio::fs::read(&binary_file_path).await {
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

    log::info!("Connecting to port {}...", upload_port);

    let mut flasher = match espflash::flasher::Flasher::connect(
        serial_interface,
        usb_port_info,
        Some(115_200),
        true,
    ) {
        Ok(flasher) => flasher,
        Err(e) => {
            log::error!("Error while connecting to port {}: {}", upload_port, e);
            return Err(format!(
                "Error while connecting to port {}: {}",
                upload_port, e
            ));
        }
    };

    log::info!("Starting flashing process...");

    let chunk_size = 1024 * 1024; // 1MB chunk size
    let mut current_flash_offset = flash_offset;

    log::debug!("Flashing buffer with length {}", binary_data_buffer.len());

    while !binary_data_buffer.is_empty() {
        let (data_chunk, remaining_data) = if binary_data_buffer.len() > chunk_size {
            binary_data_buffer.split_at(chunk_size)
        } else {
            (binary_data_buffer.as_ref(), &[][..])
        };

        log::debug!(
            "Flashing {} byte chunk at address {}, {} bytes remaining in buffer",
            data_chunk.len(),
            current_flash_offset,
            remaining_data.len()
        );

        let mut progress = FlashProgress {
            total: 0,
            current: 0,
            app_handle: app_handle.clone(),
            board_id: BoardId(upload_port.clone()),
        };

        let is_data_remaining = remaining_data.len() > 0;

        log::info!(
            "Data remaining: {}, Reboot on complete: {}",
            is_data_remaining,
            reboot
        );

        match flasher.write_bin_to_flash(
            current_flash_offset,
            data_chunk,
            Some(&mut progress),
            !is_data_remaining && reboot,
        ) {
            Ok(_) => (),
            Err(e) => {
                log::error!("Error while writing data buffer to board: {}", e);
                return Err(format!("Error while writing data buffer to board: {}", e));
            }
        };

        log::debug!(
            "Successfully flashed {} bytes with {} bytes remaining in buffer",
            data_chunk.len(),
            remaining_data.len()
        );

        current_flash_offset += data_chunk.len() as u32;
        binary_data_buffer = remaining_data.to_vec();
    }

    log::info!("Finished writing binary data to board");

    Ok(())
}

async fn init_esp32_serial_port(
    upload_port: &String,
) -> Result<espflash::interface::Interface, String> {
    let dtr = Some(1);
    let rts = Some(0);

    let serial_port_info = get_port_by_name(upload_port)?;

    let serial_interface = match espflash::interface::Interface::new(&serial_port_info, dtr, rts) {
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

    Ok(serial_interface)
}

async fn get_serial_port_info(upload_port: &String) -> Result<serialport::UsbPortInfo, String> {
    let serial_port_info = get_port_by_name(upload_port)?;

    let port_info = match serial_port_info.port_type.clone() {
        serialport::SerialPortType::UsbPort(info) => info.clone(),
        _ => {
            log::error!("Specified port is not a valid USB / Serial port");
            return Err("Specified port is not a valid USB / Serial port".to_string());
        }
    };

    Ok(port_info)
}

async fn flash_esp32(
    app_handle: tauri::AppHandle,
    temp_firmware_file_path: PathBuf,
    temp_ble_ota_file_path: PathBuf,
    temp_littlefs_file_path: PathBuf,
    upload_port: String,
) -> Result<(), String> {
    flash_esp_binary(
        app_handle.clone(),
        upload_port.clone(),
        0x0000_0000,
        temp_firmware_file_path,
        false,
    )
    .await?;

    log::info!("Successfully flashed firmware binary at 0x0000_0000");

    flash_esp_binary(
        app_handle.clone(),
        upload_port.clone(),
        0x0026_0000,
        temp_ble_ota_file_path,
        false,
    )
    .await?;

    log::info!("Successfully flashed BLE OTA binary at 0x0026_0000");

    flash_esp_binary(
        app_handle,
        upload_port,
        0x0030_0000,
        temp_littlefs_file_path,
        true,
    )
    .await?;

    log::info!("Successfully flashed LittleFS binary at 0x0030_0000");

    Ok(())
}

async fn flash_nrf(
    firmware_file_name: String,
    firmware_file_path: PathBuf,
    upload_dir: String,
) -> Result<(), String> {
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
