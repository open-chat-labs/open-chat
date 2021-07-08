use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use crate::model::user::User;
use crate::model::user_summary::UserSummary;
use candid::CandidType;
use ic_cdk_macros::query;
use serde::Deserialize;
use shared::types::UserId;

#[derive(Deserialize)]
pub struct Args {
    user_id: Option<UserId>,
    username: Option<String>,
}

#[derive(CandidType)]
pub enum Response {
    UserNotFound,
    Success(UserSummary),
}

#[query]
fn user(args: Args) -> Response {
    RUNTIME_STATE.with(|state| user_impl(args, state.borrow().as_ref().unwrap()))
}

fn user_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let mut user = None;
    if let Some(user_id) = args.user_id {
        user = runtime_state.data.users.get_by_user_id(&user_id);
    } else if let Some(username) = args.username {
        user = runtime_state.data.users.get_by_username(&username);
    }

    if let Some(User::Created(user)) = user {
        let now = runtime_state.env.now();
        return Response::Success(UserSummary::new(user, now));
    }

    Response::UserNotFound
}
