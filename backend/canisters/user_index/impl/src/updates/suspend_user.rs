use crate::guards::caller_is_super_admin;
use crate::model::set_user_suspended_queue::{SetUserSuspendedInGroup, SetUserSuspendedType};
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, UserSuspended};
use types::{ChatId, Milliseconds, SuspensionDuration, UserId};
use user_index_canister::suspend_user::{Response::*, *};

#[update(guard = "caller_is_super_admin")]
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

pub(crate) fn is_user_suspended(user_id: &UserId, runtime_state: &RuntimeState) -> Option<bool> {
    let user = runtime_state.data.users.get_by_user_id(user_id)?;
    Some(user.suspension_details.is_some())
}

fn prepare(user_id: &UserId, runtime_state: &RuntimeState) -> Result<UserId, Response> {
    match is_user_suspended(user_id, runtime_state) {
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

    runtime_state.data.set_user_suspended_queue.enqueue(
        groups
            .into_iter()
            .map(|g| {
                SetUserSuspendedType::Group(SetUserSuspendedInGroup {
                    user_id,
                    group: g,
                    suspended: true,
                    attempt: 0,
                })
            })
            .collect(),
    );
    crate::jobs::set_users_suspended::start_job_if_required(runtime_state);

    runtime_state
        .data
        .users
        .suspend_user(&user_id, duration, reason.clone(), suspended_by, now);

    // If the user is only suspended for a specified duration, schedule them to be unsuspended
    if let Some(ms) = duration {
        runtime_state
            .data
            .set_user_suspended_queue
            .schedule(vec![SetUserSuspendedType::Unsuspend(user_id)], now + ms);
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
