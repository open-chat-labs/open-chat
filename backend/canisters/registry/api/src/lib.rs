use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use types::{CanisterId, TimestampMillis};

mod lifecycle;
mod queries;

// Need to give an alias to avoid clashing with the 'crate::queries::updates' module
#[path = "updates/mod.rs"]
mod _updates;

pub use _updates::*;
pub use lifecycle::*;
pub use queries::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenDetails {
    pub ledger_canister_id: CanisterId,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub fee: u128,
    pub logo: String,
    #[serde(alias = "sns_canisters")]
    pub nervous_system: Option<NervousSystem>,
    pub info_url: String,
    pub how_to_buy_url: String,
    pub transaction_url_format: String,
    pub added: TimestampMillis,
    pub last_updated: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NervousSystem {
    #[serde(default)]
    pub is_nns: bool,
    pub root: CanisterId,
    pub governance: CanisterId,
}

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
