use crate::guards::caller_is_group_index;
use crate::model::set_user_suspended_queue::{SetUserSuspended, SetUserSuspendedType};
use crate::updates::suspend_user::is_user_suspended;
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
    runtime_state.data.set_user_suspended_queue.enqueue(
        args.user_ids
            .into_iter()
            .filter(|u| matches!(is_user_suspended(u, runtime_state), Some(false)))
            .map(|u| {
                SetUserSuspendedType::User(SetUserSuspended {
                    user_id: u,
                    duration: args.duration,
                    reason: args.reason.clone(),
                    suspended_by: args.suspended_by,
                })
            })
            .collect(),
    );
    crate::jobs::set_users_suspended::start_job_if_required(runtime_state);
    Success
}
