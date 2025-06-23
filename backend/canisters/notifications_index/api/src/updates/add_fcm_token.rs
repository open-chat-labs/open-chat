use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::FcmToken;
use types::UnitResult;

#[ts_export(notifications_index, add_fcm_token)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub fcm_token: FcmToken,
}

pub type Response = UnitResult;
