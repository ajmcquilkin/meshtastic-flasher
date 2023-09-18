use std::sync::Arc;

use tokio::sync::Mutex;

use crate::commands::api::{boards::ListBoardsResponse, firmware::ListFirmwareResponse};

pub type FirmwareReleasesStateInner = Arc<Mutex<ListFirmwareResponse>>;

#[derive(Debug, Default)]
pub struct FirmwareReleasesState {
    pub inner: FirmwareReleasesStateInner,
}

pub type BoardsStateInner = Arc<Mutex<ListBoardsResponse>>;

#[derive(Debug, Default)]
pub struct BoardsState {
    pub inner: BoardsStateInner,
}
