use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use types::{CanisterId, Milliseconds, TimestampMillis, UserId};

mod lifecycle;
mod queries;

// Need to give an alias to avoid clashing with the 'crate::queries::updates' module
#[path = "updates/mod.rs"]
mod _updates;

pub use _updates::*;
pub use lifecycle::*;
pub use queries::*;
use ts_export::ts_export;

#[ts_export(registry)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenDetails {
    pub ledger_canister_id: CanisterId,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub fee: u128,
    pub logo: String,
    pub logo_id: Option<u128>,
    pub info_url: String,
    pub how_to_buy_url: String,
    pub transaction_url_format: String,
    pub supported_standards: Vec<String>,
    pub added: TimestampMillis,
    pub enabled: bool,
    pub last_updated: TimestampMillis,
    pub payments: Vec<Payment>,
}

#[ts_export(registry)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Payment {
    pub amount: u128,
    pub block_index: u64,
    pub timestamp: TimestampMillis,
    pub user_id: UserId,
}

impl TokenDetails {
    pub fn remove_logo_if_logo_id_set(mut self) -> TokenDetails {
        if self.logo_id.is_some() {
            self.logo.clear();
        }
        self
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NervousSystemDetails {
    pub root_canister_id: CanisterId,
    pub governance_canister_id: CanisterId,
    pub swap_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub index_canister_id: CanisterId,
    pub name: String,
    pub url: Option<String>,
    pub logo: String,
    pub description: Option<String>,
    pub transaction_fee: u64,
    pub min_neuron_stake: u64,
    pub min_dissolve_delay_to_vote: Milliseconds,
    pub proposal_rejection_fee: u64,
    pub is_nns: bool,
    pub submitting_proposals_enabled: bool,
    pub added: TimestampMillis,
    pub last_updated: TimestampMillis,
}

#[ts_export(registry)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NervousSystemSummary {
    pub root_canister_id: CanisterId,
    pub governance_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub index_canister_id: CanisterId,
    pub is_nns: bool,
    pub proposal_rejection_fee: u64,
    pub submitting_proposals_enabled: bool,
}

impl From<&NervousSystemDetails> for NervousSystemSummary {
    fn from(value: &NervousSystemDetails) -> Self {
        NervousSystemSummary {
            root_canister_id: value.root_canister_id,
            governance_canister_id: value.governance_canister_id,
            ledger_canister_id: value.ledger_canister_id,
            index_canister_id: value.index_canister_id,
            is_nns: value.is_nns,
            proposal_rejection_fee: value.proposal_rejection_fee,
            submitting_proposals_enabled: value.submitting_proposals_enabled,
        }
    }
}

#[ts_export(registry)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct MessageFilterSummary {
    pub id: u64,
    pub regex: String,
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
