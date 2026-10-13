use serde::{Deserialize, Serialize};
use types::{CanisterId, Empty};

pub type Args = Empty;

// The tokens whose ledgers are installed, whether or not they are enabled
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<Token>),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Token {
    pub ledger_canister_id: CanisterId,
    pub fee: u128,
    // Burned from the sender on each transfer, on top of `fee`, by the few ledgers which charge one
    #[serde(default)]
    pub burn_fee: u128,
}
