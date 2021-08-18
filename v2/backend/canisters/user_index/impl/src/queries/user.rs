use crate::model::user::User;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use user_index_canister::user::{Response::*, *};

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
        Success(user.to_summary(now))
    } else {
        UserNotFound
    }
}
