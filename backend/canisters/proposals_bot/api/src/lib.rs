use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{icrc1::Account, CanisterId};

#[ts_export(proposals_bot)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalToSubmit {
    pub title: String,
    pub summary: String,
    pub url: String,
    pub action: ProposalToSubmitAction,
}

#[ts_export(proposals_bot)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ProposalToSubmitAction {
    Motion,
    TransferSnsTreasuryFunds(TransferSnsTreasuryFunds),
    MintSnsTokens(MintSnsTokens),
    UpgradeSnsToNextVersion,
    AdvanceSnsTargetVersion,
    UpgradeSnsControlledCanister(UpgradeSnsControlledCanister),
    ExecuteGenericNervousSystemFunction(ExecuteGenericNervousSystemFunction),
}

#[ts_export(proposals_bot)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TransferSnsTreasuryFunds {
    pub treasury: Treasury,
    pub amount: u128,
    pub to: Account,
    pub memo: Option<u64>,
}

#[ts_export(proposals_bot)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Treasury {
    ICP,
    SNS,
}

#[ts_export(proposals_bot)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MintSnsTokens {
    pub amount: u128,
    pub to: Account,
    pub memo: Option<u64>,
}

#[ts_export(proposals_bot)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpgradeSnsControlledCanister {
    pub canister_id: CanisterId,
    #[serde(with = "serde_bytes")]
    pub new_canister_wasm: Vec<u8>,
    pub mode: CanisterInstallMode,
}

#[ts_export(proposals_bot)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CanisterInstallMode {
    Install = 1,
    Reinstall = 2,
    Upgrade = 3,
}

impl From<CanisterInstallMode> for i32 {
    fn from(value: CanisterInstallMode) -> Self {
        match value {
            CanisterInstallMode::Install => 1,
            CanisterInstallMode::Reinstall => 2,
            CanisterInstallMode::Upgrade => 3,
        }
    }
}

#[ts_export(proposals_bot)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ExecuteGenericNervousSystemFunction {
    pub function_id: u64,
    #[serde(with = "serde_bytes")]
    pub payload: Vec<u8>,
}

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;
