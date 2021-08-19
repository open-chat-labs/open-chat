use crate::domain::connection_details::AllConnectionDetails;
use ic_cdk::storage;
use serde::Deserialize;
use shared::user_id::UserId;

pub fn update(request: Request) {
    let me = shared::user_id::get_current();
    let now = shared::timestamp::now();
    let connection_details: &mut AllConnectionDetails = storage::get_mut();

    for answer in request.answers {
        connection_details.add_answer(
            answer.id,
            answer.offer_id,
            me,
            answer.user_id,
            answer.connection_string,
            answer.ice_candidates,
            now,
        );
    }
}

#[derive(Deserialize)]
pub struct Request {
    answers: Vec<AddAnswerRequest>,
}

#[derive(Deserialize)]
pub struct AddAnswerRequest {
    id: String,
    offer_id: String,
    user_id: UserId,
    connection_string: String,
    ice_candidates: Vec<String>,
}
