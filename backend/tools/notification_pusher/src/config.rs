use serde::Deserialize;
use serde::de::Deserializer;
use std::fs;
use tracing::Level;
use types::{CanisterId, Error};

#[derive(Deserialize, Debug)]
pub struct Config {
    pub ic_identity_pem_file: String,
    pub vapid_private_key_pem_file: String,
    pub ic_url: String,
    pub notifications_index: CanisterId,
    pub gcloud_sa_json_path: String,
    pub pusher_threads: u32,
    #[serde(deserialize_with = "deserialize_log_level")]
    pub log_level: Level,
}

impl Config {
    pub fn from_file(path: &str) -> Result<Self, Error> {
        let content = fs::read_to_string(path)?;
        Ok(toml::from_str(&content)?)
    }
}

fn deserialize_log_level<'de, D>(deserializer: D) -> Result<Level, D::Error>
where
    D: Deserializer<'de>,
{
    let buf = String::deserialize(deserializer)?.trim().to_lowercase();

    match buf.as_str() {
        "trace" => Ok(Level::TRACE),
        "debug" => Ok(Level::DEBUG),
        "info" => Ok(Level::INFO),
        "warn" => Ok(Level::WARN),
        "error" => Ok(Level::ERROR),
        _ => Err(serde::de::Error::custom(
            "`log_level` has an unexpected value. Please use one of: trace, debug, info, warn, or error.",
        )),
    }
}
