use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum EvmContractAddress {
    Ethereum(String),
    Arbitrum(String),
    Base(String),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum Chain {
    ICP,
    Ethereum,
    Arbitrum,
    Base,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub enum EvmChain {
    Ethereum,
    Arbitrum,
    Base,
}
