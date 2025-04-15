use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::{EmptySuccessOrError, OptionUpdate, UserId};

#[ts_export(user, set_contact)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub contact: OptionalContact,
}

#[ts_export(user, set_contact)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct OptionalContact {
    pub user_id: UserId,
    #[ts(as = "types::OptionUpdateString")]
    pub nickname: OptionUpdate<String>,
}

pub type Response = EmptySuccessOrError;
