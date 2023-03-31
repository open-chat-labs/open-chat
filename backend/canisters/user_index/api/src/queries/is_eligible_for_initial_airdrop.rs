use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Yes(Option<Principal>),
    No,
    AirdropClosed,
    UserNotFound,
}
