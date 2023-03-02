use crate::guards::caller_is_platform_moderator;
use crate::timer_job_types::{SetUserSuspendedInGroup, TimerJob, UnsuspendUser};
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, UserSuspended};
use types::{ChatId, Milliseconds, SuspensionDuration, UserId};
use user_index_canister::suspend_user::{Response::*, *};

#[update(guard = "caller_is_platform_moderator")]
#[trace]
async fn suspend_user(args: Args) -> Response {
    let suspended_by = match read_state(|state| prepare(&args.user_id, state)) {
        Err(response) => return response,
        Ok(ok) => ok,
    };

    suspend_user_impl(args.user_id, args.duration, args.reason, suspended_by).await
}

pub(crate) async fn suspend_user_impl(
    user_id: UserId,
    duration: Option<Milliseconds>,
    reason: String,
    suspended_by: UserId,
) -> Response {
    let c2c_args = user_canister::c2c_set_user_suspended::Args { suspended: true };
    match user_canister_c2c_client::c2c_set_user_suspended(user_id.into(), &c2c_args).await {
        Ok(user_canister::c2c_set_user_suspended::Response::Success(result)) => {
            mutate_state(|state| commit(user_id, duration, reason, result.groups, suspended_by, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn prepare(user_id: &UserId, runtime_state: &RuntimeState) -> Result<UserId, Response> {
    match runtime_state.data.users.is_user_suspended(user_id) {
        Some(false) => {
            let caller = runtime_state.env.caller();
            Ok(runtime_state.data.users.get_by_principal(&caller).unwrap().user_id)
        }
        Some(true) => Err(UserAlreadySuspended),
        None => Err(UserNotFound),
    }
}

fn commit(
    user_id: UserId,
    duration: Option<Milliseconds>,
    reason: String,
    groups: Vec<ChatId>,
    suspended_by: UserId,
    runtime_state: &mut RuntimeState,
) {
    let now = runtime_state.env.now();
    for group in groups {
        runtime_state.data.timer_jobs.enqueue_job(
            TimerJob::SetUserSuspendedInGroup(SetUserSuspendedInGroup {
                user_id,
                group,
                suspended: true,
                attempt: 0,
            }),
            now,
            now,
        );
    }

    runtime_state
        .data
        .users
        .suspend_user(&user_id, duration, reason.clone(), suspended_by, now);

    // If the user is only suspended for a specified duration, schedule them to be unsuspended
    if let Some(ms) = duration {
        runtime_state
            .data
            .timer_jobs
            .enqueue_job(TimerJob::UnsuspendUser(UnsuspendUser { user_id }), now + ms, now);
    }

    runtime_state.data.push_event_to_local_user_index(
        user_id,
        Event::UserSuspended(UserSuspended {
            user_id,
            timestamp: now,
            duration: duration.map_or(SuspensionDuration::Indefinitely, SuspensionDuration::Duration),
            reason,
            suspended_by,
        }),
    );
    crate::jobs::sync_events_to_local_user_index_canisters::start_job_if_required(runtime_state);
}
