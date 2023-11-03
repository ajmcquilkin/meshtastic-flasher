/// A function that maps board hw model slugs to their firmware file slug name (firmware-{{ THIS }}-version.{{ EXT }})
/// TODO: Improve the Meshtastic API to a point at which the slugs match the generated firmware file names
/// TODO: Can we also add display names to the API while we're at it??
pub fn file_name_slug_from_hw_model_slug(hw_model_slug: String) -> Option<String> {
    match hw_model_slug.as_str() {
        "TLORA_V2" => Some("tlora-v2".to_string()),
        "TLORA_V1" => Some("tlora-v1".to_string()),
        "TLORA_V2_1_1P6" => Some("tlora-v2-1-1_6".to_string()),
        "TLORA_V2_1_1P8" => Some("tlora-v2-1-1_8".to_string()),
        "TLORA_T3_S3" => Some("tlora-t3s3".to_string()),
        // "TLORA_V1_1P3" => Some("???"), // ?? No idea what this corresponds to
        "TBEAM" => Some("tbeam".to_string()),
        "TBEAM_V0P7" => Some("tbeam0_7".to_string()),
        "TBEAM_S3_CORE" => Some("tbeam-s3-core".to_string()),
        "T_ECHO" => Some("t-echo".to_string()),
        "T_DECK" => Some("t-deck".to_string()),
        "T_WATCH_S3" => Some("t-watch-s3".to_string()),
        "RAK4631" => Some("rak4631".to_string()),
        "RAK11200" => Some("rak11200".to_string()),
        "RAK11310" => Some("rak11310".to_string()),
        "HELTEC_V2_0" => Some("heltec-v2_0".to_string()),
        "HELTEC_V2_1" => Some("heltec-v2_1".to_string()),
        "HELTEC_V1" => Some("heltec-v1".to_string()),
        "HELTEC_V3" => Some("heltec-v3".to_string()),
        "HELTEC_WSL_V3" => Some("heltec-wsl-v3".to_string()),
        "HELTEC_WIRELESS_TRACKER" => Some("heltec-wireless-tracker".to_string()),
        "HELTEC_WIRELESS_PAPER" => Some("heltec-wireless-paper".to_string()),
        "NANO_G1" => Some("nano-g1".to_string()),
        "NANO_G1_EXPLORER" => Some("nano-g1-explorer".to_string()),
        "STATION_G1" => Some("station-g1".to_string()),
        "NANO_G2_ULTRA" => Some("nano-g2-ultra".to_string()),
        "RPI_PICO" => Some("pico".to_string()),
        "PICOMPUTER_S3" => Some("picomputer-s3".to_string()),
        "DIY_V1" => Some("meshtastic-diy-v1".to_string()),
        "DR_DEV" => Some("meshtastic-dr-dev".to_string()),
        "M5STACK" => Some("m5stack".to_string()),
        _ => None,
    }
}
