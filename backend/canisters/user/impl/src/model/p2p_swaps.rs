use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::{Chat, TimestampMillis, TokenInfo, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct P2PSwaps {
    offers: HashMap<u32, P2PSwap>,
}

impl P2PSwaps {
    pub fn add(&mut self, swap_offer: P2PSwap) {
        if let Vacant(e) = self.offers.entry(swap_offer.id) {
            e.insert(swap_offer);
        } else {
            unreachable!()
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct P2PSwap {
    pub id: u32,
    pub chat: Chat,
    pub created_by: UserId,
    pub created: TimestampMillis,
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub expires_at: TimestampMillis,
}
