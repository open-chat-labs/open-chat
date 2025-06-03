use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::FcmToken;

#[ts_export(notifications_index, fcm_token_exists)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub fcm_token: FcmToken,
}

pub type Response = bool;
