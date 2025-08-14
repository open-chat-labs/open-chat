use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, EvmChain, PinNumberWrapper, UnitResult};

#[ts_export(user, withdraw_via_one_sec)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub token_symbol: String,
    pub amount: u128,
    pub address: String,
    pub evm_chain: EvmChain,
    pub pin: Option<PinNumberWrapper>,
}

pub type Response = UnitResult;
