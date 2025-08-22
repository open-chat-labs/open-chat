use candid::{CandidType, Deserialize};
use icrc_ledger_types::icrc1::account::Account as IcrcAccount;
use serde::Serialize;
use std::str::FromStr;

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
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Token {
    ICP,
    USDC,
    USDT,
    cbBTC,
    ckBTC,
    BOB,
    GLDT,
}

impl FromStr for Token {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_uppercase().as_str() {
            "ICP" => Ok(Self::ICP),
            "USDC" => Ok(Self::USDC),
            "USDT" => Ok(Self::USDT),
            "CBBTC" => Ok(Self::cbBTC),
            "CKBTC" => Ok(Self::ckBTC),
            "BOB" => Ok(Self::BOB),
            "GLDT" => Ok(Self::GLDT),
            _ => Err(()),
        }
    }
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
