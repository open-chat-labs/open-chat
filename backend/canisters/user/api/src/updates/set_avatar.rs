use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::{Document, EmptySuccessOrError};

#[ts_export(user, set_avatar)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub avatar: Option<Document>,
}

pub type Response = EmptySuccessOrError;
