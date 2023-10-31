use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use types::icrc1::Account;
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalToSubmit {
    pub title: String,
    pub summary: String,
    pub url: String,
    pub action: ProposalToSubmitAction,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ProposalToSubmitAction {
    Motion,
    TransferSnsTreasuryFunds(TransferSnsTreasuryFunds),
    UpgradeSnsToNextVersion,
    UpgradeSnsControlledCanister(UpgradeSnsControlledCanister),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TransferSnsTreasuryFunds {
    pub treasury: Treasury,
    pub amount: u128,
    pub to: Account,
    pub memo: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Treasury {
    ICP,
    SNS,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpgradeSnsControlledCanister {
    pub canister_id: CanisterId,
    pub new_canister_wasm: ByteBuf,
    pub mode: CanisterInstallMode,
}

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

mod lifecycle;
mod updates;

pub use lifecycle::*;
pub use updates::*;
