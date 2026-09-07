use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{P2PSwapLocation, PinNumberWrapper, TimestampMillis, TokenInfo, UserId, icrc1};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u32,
    pub location: P2PSwapLocation,
    pub created: TimestampMillis,
    pub created_by: UserId,
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token0_txn_in: u64,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub expires_at: TimestampMillis,
    // The account token1 is deposited from, defaulting to this canister's own. Any other account
    // must have approved this canister as spender, since the deposit is then pulled via ICRC-2.
    pub from_account: Option<icrc1::Account>,
    pub pin: Option<PinNumberWrapper>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64),
    Error(OCError),
}
