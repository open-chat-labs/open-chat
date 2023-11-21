use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Copy)]
#[allow(non_camel_case_types)]
pub enum Level {
    hard,
    normal,
    simple,
    xhard,
}

pub type Args = (String, String, Option<String>, Option<Level>);
pub type Response = (String,);
