use ic_cdk::storage;
use serde::Deserialize;
use shared::user_id::UserId;
use crate::domain::connection_details::AllConnectionDetails;

pub fn update(request: Request) {
    let me = shared::user_id::get_current();
    let now = shared::timestamp::now();
    let connection_details: &mut AllConnectionDetails = storage::get_mut();

    connection_details.add_answer(
        request.id,
        request.offer_id,
        me,
        request.user_id,
        request.connection_string,
        request.ice_candidates,
        now);
}

#[derive(Deserialize)]
pub struct Request {
    id: String,
    offer_id: String,
    user_id: UserId,
    connection_string: String,
    ice_candidates: Vec<String>
}
