use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, create_challenge)]
pub enum Response {
    NotRequired,
}
