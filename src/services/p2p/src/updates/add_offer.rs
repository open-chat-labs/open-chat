use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::user_id::UserId;
use crate::domain::connection_details::{AllConnectionDetails, CounterOffer};

pub fn update(request: Request) -> Response {
    let me = shared::user_id::get_current();
    let now = shared::timestamp::now();
    let connection_details: &mut AllConnectionDetails = storage::get_mut();

    let counter_offer = connection_details.add_offer(
        request.id,
        me,
        request.user_id,
        request.connection_string,
        request.ice_candidates,
        now);

    let result = Result {
        offer_added: counter_offer.is_none(),
        existing_counter_offer: counter_offer
    };

    Response::Success(result)
}

#[derive(Deserialize)]
pub struct Request {
    id: String,
    user_id: UserId,
    connection_string: String,
    ice_candidates: Vec<String>
}

#[derive(CandidType)]
pub enum Response {
    Success(Result)
}

#[derive(CandidType)]
pub struct Result {
    offer_added: bool,
    existing_counter_offer: Option<CounterOffer>
}
