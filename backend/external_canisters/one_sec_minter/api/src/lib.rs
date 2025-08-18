use candid::{CandidType, Deserialize, Principal};
use icrc_ledger_types::icrc1::account::Account as IcrcAccount;
use serde::Serialize;

mod queries;
mod updates;

pub use queries::*;
pub use updates::*;

pub const ONE_SEC_MINTER_CANISTER_ID: Principal = Principal::from_slice(&[0, 0, 0, 0, 2, 48, 11, 124, 1, 1]);

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

#[test]
fn one_sec_minter_canister_id() {
    let canister_id = Principal::from_text("5okwm-giaaa-aaaar-qbn6a-cai").unwrap();

    assert_eq!(canister_id, ONE_SEC_MINTER_CANISTER_ID);
}
