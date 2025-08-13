use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{EvmChain, PinNumberWrapper, UnitResult};

#[ts_export(user, withdraw_via_one_sec)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub token_symbol: String,
    pub amount: u64,
    pub address: String,
    pub evm_chain: EvmChain,
    pub pin: Option<PinNumberWrapper>,
}

pub type Response = UnitResult;
