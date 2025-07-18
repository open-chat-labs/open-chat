use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;

#[ts_export(identity, verify_account_linking_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub code: String,
}

#[ts_export(notifications_index, verify_account_linking_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Response(pub bool);
