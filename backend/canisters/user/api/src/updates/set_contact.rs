use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::{OptionUpdate, UserId};

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

#[ts_export(user, set_contact)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Error(OCError),
}
