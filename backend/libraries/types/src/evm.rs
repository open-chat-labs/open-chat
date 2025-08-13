use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub enum EvmChain {
    Ethereum,
    Arbitrum,
    Base,
}
