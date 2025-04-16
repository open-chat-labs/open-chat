use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Chat, UnitResult};

#[ts_export(user, manage_favourite_chats)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub to_add: Vec<Chat>,
    pub to_remove: Vec<Chat>,
}

pub type Response = UnitResult;
