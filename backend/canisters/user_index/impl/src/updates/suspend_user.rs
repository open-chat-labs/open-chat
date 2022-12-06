use crate::guards::caller_is_super_admin;
use crate::model::set_user_suspended_queue::{SetUserSuspended, SetUserSuspendedInGroup};
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{ChatId, Milliseconds, UserId};
use user_index_canister::suspend_user::{Response::*, *};

#[update(guard = "caller_is_super_admin")]
#[trace]
async fn suspend_user(args: Args) -> Response {
    let c2c_args = user_canister::c2c_set_user_suspended::Args { suspended: true };
    match user_canister_c2c_client::c2c_set_user_suspended(args.user_id.into(), &c2c_args).await {
        Ok(user_canister::c2c_set_user_suspended::Response::Success(result)) => {
            mutate_state(|state| commit(args.user_id, args.duration, result.groups, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn commit(user_id: UserId, duration: Option<Milliseconds>, groups: Vec<ChatId>, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();

    runtime_state.data.set_user_suspended_queue.enqueue(
        groups
            .into_iter()
            .map(|g| {
                SetUserSuspended::Group(SetUserSuspendedInGroup {
                    user_id,
                    group: g,
                    suspended: true,
                    attempt: 0,
                })
            })
            .collect(),
    );
    let suspended_until = duration.map(|d| now + d);

    runtime_state.data.users.suspend_user(&user_id, suspended_until, now);

    // If the user is only suspended for a specified duration, schedule them to be unsuspended
    if let Some(ts) = suspended_until {
        runtime_state
            .data
            .set_user_suspended_queue
            .schedule(vec![SetUserSuspended::Unsuspend(user_id)], ts);
    }
}
