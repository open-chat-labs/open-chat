use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::Entry::Vacant;
use types::{P2PSwapLocation, TimestampMillis, TokenInfo, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct P2PSwaps {
    swaps: HashMap<u32, P2PSwap>,
}

impl P2PSwaps {
    pub fn add(&mut self, swap: P2PSwap) {
        if let Vacant(e) = self.swaps.entry(swap.id) {
            e.insert(swap);
        } else {
            unreachable!()
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct P2PSwap {
    pub id: u32,
    pub location: P2PSwapLocation,
    pub created_by: UserId,
    pub created: TimestampMillis,
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub expires_at: TimestampMillis,
}
