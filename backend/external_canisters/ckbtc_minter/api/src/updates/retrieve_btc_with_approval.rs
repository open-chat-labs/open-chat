use candid::CandidType;
use icrc_ledger_types::icrc1::account::Subaccount;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub amount: u64,
    pub address: String,
    pub from_subaccount: Option<Subaccount>,
}

pub type Response = Result<RetrieveBtcOk, RetrieveBtcWithApprovalError>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct RetrieveBtcOk {
    pub block_index: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum RetrieveBtcWithApprovalError {
    AlreadyProcessing,
    AmountTooLow(u64),
    MalformedAddress(String),
    InsufficientFunds { balance: u64 },
    InsufficientAllowance { allowance: u64 },
    TemporarilyUnavailable(String),
    GenericError { error_message: String, error_code: u64 },
}
