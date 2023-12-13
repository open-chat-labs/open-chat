use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::{TimestampMillis, TokenInfo, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct P2PTrades {
    offers: HashMap<u32, P2PTradeOffer>,
}

impl P2PTrades {
    pub fn add(&mut self, trade_offer: P2PTradeOffer) {
        if let Vacant(e) = self.offers.entry(trade_offer.id) {
            e.insert(trade_offer);
        } else {
            unreachable!()
        }
    }

    pub fn get(&self, offer_id: u32) -> Option<&P2PTradeOffer> {
        self.offers.get(&offer_id)
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
    pub created_by: UserId,
    pub created: TimestampMillis,
    pub status: P2PTradeOfferStatus,
    pub last_updated: TimestampMillis,
    pub input_token: TokenInfo,
    pub input_amount: u128,
    pub input_transaction_index: Option<u64>,
    pub output_token: TokenInfo,
    pub output_amount: u128,
    pub output_transaction_index: Option<u64>,
    pub expires_at: TimestampMillis,
}

impl P2PTradeOffer {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: u32,
        created_by: UserId,
        input_token: TokenInfo,
        input_amount: u128,
        output_token: TokenInfo,
        output_amount: u128,
        expires_at: TimestampMillis,
        now: TimestampMillis,
    ) -> P2PTradeOffer {
        P2PTradeOffer {
            id,
            created_by,
            created: now,
            status: P2PTradeOfferStatus::Pending,
            last_updated: now,
            input_token,
            input_amount,
            input_transaction_index: None,
            output_token,
            output_amount,
            output_transaction_index: None,
            expires_at,
        }
    }
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
