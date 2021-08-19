use crate::domain::connection_details::{AllConnectionDetails, OfferSummary};
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::user_id::UserId;

pub fn update(request: Request) -> Response {
    let me = shared::user_id::get_current();
    let now = shared::timestamp::now();
    let connection_details: &mut AllConnectionDetails = storage::get_mut();

    let counter_offers: Vec<_> = request
        .offers
        .into_iter()
        .filter_map(|o| {
            connection_details.add_offer(
                o.id,
                me,
                o.user_id,
                o.connection_string,
                o.ice_candidates,
                now,
            )
        })
        .collect();

    let result = Result { counter_offers };

    Response::Success(result)
}

#[derive(Deserialize)]
pub struct Request {
    offers: Vec<AddOfferRequest>,
}

#[derive(Deserialize)]
pub struct AddOfferRequest {
    id: String,
    user_id: UserId,
    connection_string: String,
    ice_candidates: Vec<String>,
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType)]
pub struct Result {
    counter_offers: Vec<OfferSummary>,
}
