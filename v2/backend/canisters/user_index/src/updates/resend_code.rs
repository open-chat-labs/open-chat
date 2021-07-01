use candid::CandidType;
use crate::model::data::append_sms_to_queue;
use crate::model::user::User;
use crate::model::runtime_state::RuntimeState;
use serde::Deserialize;

pub fn update(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        match user {
            User::Unconfirmed(u) => {
                append_sms_to_queue(
                    &mut runtime_state.data.sms_queue,
                    u.phone_number.clone(),
                    u.confirmation_code.to_string());
                Response::Success
            },
            _ => Response::AlreadyClaimed
        }
    } else {
        Response::UserNotFound
    }
}

#[derive(Deserialize)]
pub struct Request {
}

#[derive(CandidType)]
pub enum Response {
    Success,
    AlreadyClaimed,
    UserNotFound,
}
