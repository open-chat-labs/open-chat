use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::{Document, UnitResult};

#[ts_export(user, set_profile_background)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub profile_background: Option<Document>,
}

pub type Response = UnitResult;
