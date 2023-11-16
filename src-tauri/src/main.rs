// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::{debug, error, info};
use tauri::{CustomMenuItem, Manager, Menu, MenuItem, Submenu};
use tauri_plugin_log::LogTarget;

pub mod api;
pub mod commands;
pub mod flasher;
pub mod fs;
pub mod state;

enum MenuItemId {
    RefreshSerialPorts,
    ShowWelcomeScreen,
    ToggleFullscreen,
    RakWirelessDiscount,
    SupportMyWork,
    CopyVersionNumber,
    CopyLogDirectory,
    OpenLogFile,
    ReportBug,
}

impl<'a> From<&str> for MenuItemId {
    fn from(s: &str) -> Self {
        match s {
            "refresh_serial_ports" => MenuItemId::RefreshSerialPorts,
            "show_welcome_screen" => MenuItemId::ShowWelcomeScreen,
            "toggle_fullscreen" => MenuItemId::ToggleFullscreen,
            "rak_wireless_discount" => MenuItemId::RakWirelessDiscount,
            "support_my_work" => MenuItemId::SupportMyWork,
            "copy_version_number" => MenuItemId::CopyVersionNumber,
            "copy_log_directory" => MenuItemId::CopyLogDirectory,
            "open_log_file" => MenuItemId::OpenLogFile,
            "report_bug" => MenuItemId::ReportBug,
            _ => panic!("Unknown menu item id: {}", s),
        }
    }
}

impl MenuItemId {
    fn id(&self) -> String {
        match self {
            MenuItemId::RefreshSerialPorts => "refresh_serial_ports",
            MenuItemId::ShowWelcomeScreen => "show_welcome_screen",
            MenuItemId::ToggleFullscreen => "toggle_fullscreen",
            MenuItemId::RakWirelessDiscount => "rak_wireless_discount",
            MenuItemId::SupportMyWork => "support_my_work",
            MenuItemId::CopyVersionNumber => "copy_version_number",
            MenuItemId::CopyLogDirectory => "copy_log_directory",
            MenuItemId::OpenLogFile => "open_log_file",
            MenuItemId::ReportBug => "report_bug",
        }
        .to_string()
    }
}

fn build_menu() -> Menu {
    // File menu
    let file_menu = Submenu::new(
        "File",
        Menu::new()
            .add_item(CustomMenuItem::new(
                MenuItemId::RefreshSerialPorts.id(),
                "Refresh Serial Ports".to_string(),
            ))
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::Quit),
    );

    // View menu
    let view_menu = Submenu::new(
        "View",
        Menu::new()
            .add_item(CustomMenuItem::new(
                MenuItemId::ShowWelcomeScreen.id(),
                "Show Welcome Screen".to_string(),
            ))
            // .add_native_item(MenuItem::EnterFullScreen)
            .add_item(CustomMenuItem::new(
                MenuItemId::ToggleFullscreen.id(),
                "Toggle Fullscreen".to_string(), // Manage state to change title
            )),
    );

    // Info menu
    let info_menu = Submenu::new(
        "Info",
        Menu::new()
            .add_item(CustomMenuItem::new(
                MenuItemId::RakWirelessDiscount.id(),
                "RAK Wireless Discount".to_string(),
            ))
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new(
                MenuItemId::SupportMyWork.id(),
                "Support my Work".to_string(),
            )),
    );

    // Help menu
    let help_menu = Submenu::new(
        "Help",
        Menu::new()
            .add_item(CustomMenuItem::new(
                MenuItemId::CopyVersionNumber.id(),
                "Copy Version Number".to_string(),
            ))
            .add_native_item(MenuItem::About(
                "Meshtastic Desktop Flasher".to_string(),
                tauri::AboutMetadata::new()
                    .version(env!("CARGO_PKG_VERSION").to_string())
                    .authors(vec!["Adam McQuilkin".to_string()])
                    .license("GPLv3".to_string())
                    .comments("A desktop application for flashing Meshtastic devices".to_string())
                    .website("https://meshtastic.org/".to_string())
                    .website_label("Meshtastic".to_string()),
            ))
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new(
                MenuItemId::CopyLogDirectory.id(),
                "Copy Log Directory to Clipboard".to_string(),
            ))
            .add_item(CustomMenuItem::new(
                MenuItemId::OpenLogFile.id(),
                "Open Application Log File".to_string(),
            ))
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new(
                MenuItemId::ReportBug.id(),
                "Report a Bug".to_string(),
            )),
    );

    // Construct the full menu
    let menu = Menu::new()
        .add_submenu(file_menu)
        .add_submenu(view_menu)
        .add_submenu(info_menu)
        .add_submenu(help_menu);

    menu
}

fn main() {
    let menu = build_menu();

    tauri::Builder::default()
        .menu(menu)
        .setup(|app| {
            let window = app.get_window("main").ok_or("Could not find main window")?;

            let app_handle = app.app_handle().clone();

            debug!("Spawning updater task...");

            tauri::async_runtime::spawn(async move {
                let main_window = app_handle.get_window("main");
                let main_window_ref = main_window.as_ref();

                match tauri::updater::builder(app_handle.clone()).check().await {
                    Ok(update) => {
                        if !update.is_update_available() {
                            debug!("No update available");
                            return;
                        }

                        let latest_version = update.latest_version().to_string();

                        let should_update = tauri::api::dialog::blocking::ask(
                            main_window_ref,
                            format!("Update available to version {}", latest_version),
                            format!("Update is available from current version {} to {}. Would you like to install it now?", env!("CARGO_PKG_VERSION"), latest_version),
                        );

                        if !should_update {
                            debug!("User declined update to version {}", latest_version);
                            return;
                        }

                        info!("Downloading and installing update to version {}", latest_version);

                        match update.download_and_install().await {
                            Ok(_) => {
                                debug!("Update to version {} downloaded and installed successfully", latest_version);
                            }
                            Err(e) => {
                                error!("Error installing update: {}", e);
                                return;
                            }
                        }

                        info!("Update installed, restarting application...");

                        tauri::api::dialog::blocking::message(main_window_ref, "Update Successful", format!("Update to version {} was successful! You can now close this window.", latest_version));
                    }
                    Err(e) => {
                        error!("Error during update flow: {}", e);
                    }
                }
            });

            let app_handle = app.app_handle().clone();

            window.on_menu_event(move |e| {
                log::debug!("Menu event: {:?}", e);

                match app_handle.emit_all(e.menu_item_id(), "".to_string()) {
                    Ok(_) => {
                        log::debug!("Event emitted successfully");
                    }
                    Err(e) => {
                        log::error!("Error emitting event: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fetch_firmware_releases,
            commands::fetch_supported_boards,
            commands::flash_device,
            commands::get_available_serial_ports,
            commands::quit_application,
        ])
        .manage(state::BoardsState::default())
        .manage(state::FirmwareReleasesState::default())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([LogTarget::LogDir, LogTarget::Stdout, LogTarget::Webview])
                .log_name("application")
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}
