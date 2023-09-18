use reqwest;
// use std::io::{Cursor, Read};
// use tauri::{api::path::app_data_dir, Config};
// use zip::read::ZipArchive;

use crate::state;

pub mod api {
    pub const MESHTASTIC_API_URL: &str = "https://api.meshtastic.org";

    pub mod boards {
        pub type ListBoardsResponse = Vec<Board>;

        #[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
        #[serde(rename_all = "camelCase")]
        pub struct Board {
            hw_model: u32,
            hw_model_slug: String,
            platformio_target: String,
            architecture: String,
            actively_supported: bool,
        }
    }

    pub mod firmware {

        #[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
        #[serde(rename_all = "camelCase")]
        pub struct ListFirmwareResponse {
            releases: FirmwareReleases,
            pull_requests: Vec<PullRequest>,
        }

        #[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
        pub struct FirmwareReleases {
            stable: Vec<FirmwareRelease>,
            alpha: Vec<FirmwareRelease>,
        }

        #[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
        pub struct FirmwareRelease {
            id: String,
            title: String,
            page_url: String,
            zip_url: String,
        }

        #[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
        pub struct PullRequest {
            id: String,
            title: String,
            page_url: String,
            zip_url: String,
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
