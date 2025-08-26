use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct EvmContractAddress {
    pub chain: EvmChain,
    pub address: String,
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
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum EvmChain {
    Ethereum,
    Arbitrum,
    Base,
}

impl TryFrom<Chain> for EvmChain {
    type Error = ();

    fn try_from(value: Chain) -> Result<Self, Self::Error> {
        match value {
            Chain::Ethereum => Ok(EvmChain::Ethereum),
            Chain::Arbitrum => Ok(EvmChain::Arbitrum),
            Chain::Base => Ok(EvmChain::Base),
            _ => Err(()),
        }
    }
}
