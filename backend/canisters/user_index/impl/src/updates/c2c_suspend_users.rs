use crate::guards::caller_is_group_index;
use crate::model::set_user_suspended_queue::SetUserSuspended;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_index_canister::c2c_suspend_users::{Response::*, *};

#[update_msgpack(guard = "caller_is_group_index")]
#[trace]
fn c2c_suspend_users(args: Args) -> Response {
    mutate_state(|state| c2c_suspend_users_impl(args, state))
}

fn c2c_suspend_users_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    let suspended_until = args.duration.map(|d| now + d);

    let users_to_suspend: Vec<_> = args
        .user_ids
        .into_iter()
        .filter(|u| runtime_state.data.users.suspend_user(&u, suspended_until, now))
        .collect();

    runtime_state.data.set_user_suspended_queue.enqueue(
        users_to_suspend
            .iter()
            .map(|u| SetUserSuspended::User(*u, suspended_until))
            .collect(),
    );

    if let Some(ts) = suspended_until {
        runtime_state
            .data
            .set_user_suspended_queue
            .schedule(users_to_suspend.iter().map(|u| SetUserSuspended::Unsuspend(*u)).collect(), ts);
    }

    Success
}
