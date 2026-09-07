use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MediaScanConfig, UnitResult};

#[ts_export(user_index, set_media_scan_config)]
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Args {
    pub config: MediaScanConfig,
}

pub type Response = UnitResult;
