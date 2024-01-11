use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{
    icrc1::CompletedCryptoTransaction, CanisterId, OfferStatus, OfferStatusAccepted, OfferStatusCancelled,
    OfferStatusCompleted, TimestampMillis, TokenInfo, UserId,
};

#[derive(Serialize, Deserialize, Default)]
pub struct Offers {
    map: BTreeMap<u32, Offer>,
}

impl Offers {
    pub fn push(&mut self, caller: UserId, args: escrow_canister::create_offer::Args, now: TimestampMillis) -> u32 {
        let id = self.map.last_key_value().map(|(k, _)| *k).unwrap_or_default();
        self.map.insert(id, Offer::new(id, caller, args, now));
        id
    }

    pub fn get(&self, id: u32) -> Option<&Offer> {
        self.map.get(&id)
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
    pub token0_transfer_out: Option<CompletedCryptoTransaction>,
    pub token1_transfer_out: Option<CompletedCryptoTransaction>,
    pub refunds: Vec<CompletedCryptoTransaction>,
    pub canister_to_notify: Option<CanisterId>,
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
            token0_transfer_out: None,
            token1_transfer_out: None,
            refunds: Vec::new(),
            canister_to_notify: args.canister_to_notify,
        }
    }

    pub fn is_complete(&self) -> bool {
        self.token0_transfer_out.is_some() && self.token1_transfer_out.is_some()
    }

    pub fn status(&self, now: TimestampMillis) -> OfferStatus {
        if let Some((accepted_by, accepted_at)) = self.accepted_by {
            if let (Some(token0_transfer_out), Some(token1_transfer_out)) =
                (self.token0_transfer_out.clone(), self.token1_transfer_out.clone())
            {
                OfferStatus::Completed(Box::new(OfferStatusCompleted {
                    accepted_by,
                    accepted_at,
                    token0_transfer_out,
                    token1_transfer_out,
                }))
            } else {
                OfferStatus::Accepted(Box::new(OfferStatusAccepted {
                    accepted_by,
                    accepted_at,
                }))
            }
        } else if let Some(cancelled_at) = self.cancelled_at {
            OfferStatus::Cancelled(Box::new(OfferStatusCancelled { cancelled_at }))
        } else if self.expires_at < now {
            OfferStatus::Expired
        } else {
            OfferStatus::Open
        }
    }
}
