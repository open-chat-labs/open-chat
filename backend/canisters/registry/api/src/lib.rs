use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Debug)]
// TODO uncomment the line below once candid is aware of the `rename_all` attribute
// #[serde(rename_all = "lowercase")]
pub enum TokenStandard {
    #[serde(rename = "icrc1")]
    ICRC1,
}

impl Display for TokenStandard {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ICRC1 => f.write_str("icrc1"),
        }
    }
}
