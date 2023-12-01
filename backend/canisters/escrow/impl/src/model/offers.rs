use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{CompletedCryptoTransaction, TimestampMillis, TokenInfo, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Offers {
    map: BTreeMap<u32, Offer>,
}

impl Offers {
    pub fn push(&mut self, caller: UserId, args: escrow_canister::create_offer::Args, now: TimestampMillis) -> u32 {
        let id = self.map.last_key_value().map_or(1, |(k, _)| *k);
        self.map.insert(id, Offer::new(id, caller, args, now));
        id
    }

    pub fn get_mut(&mut self, id: u32) -> Option<&mut Offer> {
        self.map.get_mut(&id)
    }
}

#[derive(Serialize, Deserialize)]
pub struct Offer {
    pub id: u32,
    pub created_at: TimestampMillis,
    pub created_by: UserId,
    pub token0: TokenInfo,
    pub amount0: u128,
    pub token1: TokenInfo,
    pub amount1: u128,
    pub expires_at: TimestampMillis,
    pub cancelled_at: Option<TimestampMillis>,
    pub accepted_by: Option<(UserId, TimestampMillis)>,
    pub token0_received: bool,
    pub token1_received: bool,
    pub transfer_out0: Option<CompletedCryptoTransaction>,
    pub transfer_out1: Option<CompletedCryptoTransaction>,
}

impl Offer {
    pub fn new(id: u32, caller: UserId, args: escrow_canister::create_offer::Args, now: TimestampMillis) -> Offer {
        Offer {
            id,
            created_at: now,
            created_by: caller,
            token0: args.input_token,
            amount0: args.input_amount,
            token1: args.output_token,
            amount1: args.output_amount,
            expires_at: args.expires_at,
            cancelled_at: None,
            accepted_by: None,
            token0_received: false,
            token1_received: false,
            transfer_out0: None,
            transfer_out1: None,
        }
    }
}
