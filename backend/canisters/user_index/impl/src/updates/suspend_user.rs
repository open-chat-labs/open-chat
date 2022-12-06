use crate::guards::caller_is_super_admin;
use crate::model::set_user_suspended_queue::{SetUserSuspended, SetUserSuspendedInGroup};
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{ChatId, Milliseconds, SuspensionDuration, UserEvent, UserId, UserSuspended};
use user_index_canister::suspend_user::{Response::*, *};

#[update(guard = "caller_is_super_admin")]
#[trace]
async fn suspend_user(args: Args) -> Response {
    suspend_user_impl(args.user_id, args.duration).await
}

pub(crate) async fn suspend_user_impl(user_id: UserId, duration: Option<Milliseconds>) -> Response {
    let c2c_args = user_canister::c2c_set_user_suspended::Args { suspended: true };
    match user_canister_c2c_client::c2c_set_user_suspended(user_id.into(), &c2c_args).await {
        Ok(user_canister::c2c_set_user_suspended::Response::Success(result)) => {
            mutate_state(|state| commit(user_id, duration, reason, result.groups, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn commit(
    user_id: UserId,
    duration: Option<Milliseconds>,
    reason: String,
    groups: Vec<ChatId>,
    runtime_state: &mut RuntimeState,
) {
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

    runtime_state.data.users.suspend_user(&user_id, duration, reason.clone(), now);

    // If the user is only suspended for a specified duration, schedule them to be unsuspended
    if let Some(ms) = duration {
        runtime_state
            .data
            .set_user_suspended_queue
            .schedule(vec![SetUserSuspended::Unsuspend(user_id)], now + ms);
    }

    runtime_state.data.user_event_sync_queue.push(
        user_id,
        UserEvent::UserSuspended(UserSuspended {
            timestamp: now,
            duration: duration.map_or(SuspensionDuration::Indefinitely, SuspensionDuration::Duration),
            reason,
        }),
    );
}
