use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

mod lifecycle;
mod queries;

// Need to give an alias to avoid clashing with the 'crate::queries::updates' module
#[path = "updates/mod.rs"]
mod _updates;

pub use _updates::*;
pub use lifecycle::*;
pub use queries::*;

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
