use crate::guards::caller_is_platform_moderator;
use crate::timer_job_types::{SetUserSuspendedInGroup, TimerJob};
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{ChatId, UserId};
use user_index_canister::unsuspend_user::{Response::*, *};

#[update(guard = "caller_is_platform_moderator")]
#[trace]
async fn unsuspend_user(args: Args) -> Response {
    match read_state(|state| state.data.users.is_user_suspended(&args.user_id)) {
        Some(true) => unsuspend_user_impl(args.user_id).await,
        Some(false) => UserNotSuspended,
        None => UserNotFound,
    }
}

pub(crate) async fn unsuspend_user_impl(user_id: UserId) -> Response {
    let c2c_args = user_canister::c2c_set_user_suspended::Args { suspended: false };
    match user_canister_c2c_client::c2c_set_user_suspended(user_id.into(), &c2c_args).await {
        Ok(user_canister::c2c_set_user_suspended::Response::Success(result)) => {
            mutate_state(|state| commit(user_id, result.groups, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn commit(user_id: UserId, groups: Vec<ChatId>, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    for group in groups {
        runtime_state.data.timer_jobs.enqueue_job(
            TimerJob::SetUserSuspendedInGroup(SetUserSuspendedInGroup {
                user_id,
                group,
                suspended: false,
                attempt: 0,
            }),
            now,
            now,
        );
    }
    runtime_state.data.users.unsuspend_user(&user_id);
}
