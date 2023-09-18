// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;
pub mod state;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::fetch_firmware_releases,
            commands::fetch_supported_boards,
            // commands::download_release_assets,
        ])
        .manage(state::BoardsState::default())
        .manage(state::FirmwareReleasesState::default())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
