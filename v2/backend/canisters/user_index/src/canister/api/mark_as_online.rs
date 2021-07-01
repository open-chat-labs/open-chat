use candid::CandidType;
use crate::canister::RUNTIME_STATE;
use crate::model::user::User;
use crate::model::runtime_state::RuntimeState;
use crate::model::user_map::UpdateUserResult;
use ic_cdk_macros::update;
use serde::Deserialize;

#[update]
fn mark_as_online(_: Request) -> Response {
    RUNTIME_STATE.with(|state| {
        mark_as_online_impl(state.borrow_mut().as_mut().unwrap())
    })
}

fn mark_as_online_impl(runtime_state: &mut RuntimeState) -> Response {
    if let Some(user) = runtime_state.data.users.get_by_principal(&runtime_state.env.caller()) {
        let mut user = user.clone();
        let now = runtime_state.env.now();
        if matches!(user, User::Created(_)) {
            user.set_last_online(now);
            match runtime_state.data.users.update(user) {
                UpdateUserResult::Success => Response::Success,
                UpdateUserResult::PhoneNumberTaken => panic!("PhoneNumberTaken returned when setting last online"),
                UpdateUserResult::UsernameTaken => panic!("UsernameTaken returned when setting last online"),
                UpdateUserResult::UserNotFound => Response::UserNotFound,
            }
        } else {
            Response::UserNotFound
        }
    } else {
        Response::UserNotFound
    }
}

#[derive(Deserialize)]
pub struct Request {
}


#[allow(dead_code)]
#[derive(CandidType)]
pub enum Response {
    Success,
    UserNotFound,
}
