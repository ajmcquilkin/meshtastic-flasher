// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;
pub mod state;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::fetch_firmware_releases,
            commands::fetch_supported_boards,
            commands::get_available_serial_ports,
            commands::flash_device,
        ])
        .manage(state::BoardsState::default())
        .manage(state::FirmwareReleasesState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
