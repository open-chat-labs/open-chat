use candid::{CandidType, Deserialize};
use icrc_ledger_types::icrc1::account::Account as IcrcAccount;
use serde::Serialize;

mod queries;
mod updates;

pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EvmAccount {
    pub address: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum IcpAccount {
    ICRC(IcrcAccount),
    AccountId(String),
}

#[allow(non_camel_case_types)]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub enum Token {
    ICP,
    USDC,
    USDT,
    cbBTC,
    ckBTC,
    BOB,
    GLDT,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub struct TransferId {
    pub id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub struct FetchedBlock {
    pub block_height: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ErrorMessage {
    pub error: String,
}
