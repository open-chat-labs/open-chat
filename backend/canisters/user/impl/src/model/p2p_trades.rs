use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::{TimestampMillis, TokenInfo};

#[derive(Serialize, Deserialize, Default)]
pub struct P2PTrades {
    offers: HashMap<u32, P2PTradeOffer>,
}

impl P2PTrades {
    pub fn add(
        &mut self,
        id: u32,
        input_token: TokenInfo,
        input_amount: u128,
        output_token: TokenInfo,
        output_amount: u128,
        expires_at: TimestampMillis,
        now: TimestampMillis,
    ) -> u32 {
        if let Vacant(e) = self.offers.entry(id) {
            e.insert(P2PTradeOffer {
                id,
                created: now,
                status: P2PTradeOfferStatus::Pending,
                last_updated: now,
                input_token,
                input_amount,
                output_token,
                output_amount,
                expires_at,
            });
        } else {
            unreachable!()
        }
        id
    }

    pub fn set_offer_status(&mut self, id: u32, status: P2PTradeOfferStatus, now: TimestampMillis) {
        if let Some(offer) = self.offers.get_mut(&id) {
            offer.status = status;
            offer.last_updated = now;
        } else {
            unreachable!()
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct P2PTradeOffer {
    pub id: u32,
    pub created: TimestampMillis,
    pub status: P2PTradeOfferStatus,
    pub last_updated: TimestampMillis,
    pub input_token: TokenInfo,
    pub input_amount: u128,
    pub output_token: TokenInfo,
    pub output_amount: u128,
    pub expires_at: TimestampMillis,
}

#[derive(Serialize, Deserialize)]
pub enum P2PTradeOfferStatus {
    Pending,
    FundsTransferred,
    TransferError(String),
    Open,
    Accepted,
    Completed,
}
