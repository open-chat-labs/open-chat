use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use types::user::User;
use types::user_summary::UserSummary;
use user_index_canister::queries::user::{Response::*, *};

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
        let millis_since_last_online = now - user.last_online;
        let seconds_since_last_online = (millis_since_last_online / 1000) as u32;

        Success(UserSummary {
            user_id: user.user_id,
            username: user.username.clone(),
            seconds_since_last_online,
        })
    } else {
        UserNotFound
    }
}
