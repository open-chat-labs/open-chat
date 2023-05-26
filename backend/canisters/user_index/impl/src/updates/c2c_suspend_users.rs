use crate::guards::caller_is_group_index;
use crate::timer_job_types::{SetUserSuspended, TimerJob};
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_index_canister::c2c_suspend_users::{Response::*, *};

#[update_msgpack(guard = "caller_is_group_index")]
#[trace]
fn c2c_suspend_users(args: Args) -> Response {
    mutate_state(|state| c2c_suspend_users_impl(args, state))
}

fn c2c_suspend_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    for user_id in args.user_ids {
        if matches!(state.data.users.is_user_suspended(&user_id), Some(false)) {
            state.data.timer_jobs.enqueue_job(
                TimerJob::SetUserSuspended(SetUserSuspended {
                    user_id,
                    duration: args.duration,
                    reason: args.reason.clone(),
                    suspended_by: args.suspended_by,
                }),
                now,
                now,
            );
        }
    }
    Success
}
