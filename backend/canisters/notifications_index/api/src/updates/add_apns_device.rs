use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ApnsDevice, UnitResult};

#[ts_export(notifications_index, add_apns_device)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub device: ApnsDevice,
}

pub type Response = UnitResult;
