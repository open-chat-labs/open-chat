use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub offer_id: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    OfferAlreadyAccepted,
    OfferExpired,
    OfferNotFound,
    NotAuthorized,
}
