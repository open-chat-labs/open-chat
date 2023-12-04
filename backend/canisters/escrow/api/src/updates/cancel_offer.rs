use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub offer_id: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    OfferAlreadyAccepted,
    OfferExpired,
    OfferNotFound,
    NotAuthorized,
}
