use crate::guards::caller_is_platform_moderator;
use crate::timer_job_types::{SetUserSuspendedInCommunity, SetUserSuspendedInGroup, TimerJob};
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{ChatId, CommunityId, UserId};
use user_index_canister::unsuspend_user::{Response::*, *};

#[update(guard = "caller_is_platform_moderator", msgpack = true)]
#[trace]
async fn unsuspend_user(args: Args) -> Response {
    // A moderator must never lift a sanction imposed on themselves. A suspended account no
    // longer passes the moderator guard at all (suspension freezes every privilege), so this
    // self-check is defence in depth for the case where the guard semantics ever regress.
    if read_state(|state| caller_is(&args.user_id, state)) {
        return Error(OCErrorCode::InitiatorNotAuthorized.with_message("Cannot unsuspend yourself"));
    }

    match read_state(|state| state.data.users.is_user_suspended(&args.user_id)) {
        Some(true) => unsuspend_user_impl(args.user_id).await,
        Some(false) => UserNotSuspended,
        None => UserNotFound,
    }
}

fn caller_is(user_id: &UserId, state: &RuntimeState) -> bool {
    state
        .data
        .users
        .get_by_principal(&state.env.caller())
        .is_some_and(|u| u.user_id == *user_id)
}

pub(crate) async fn unsuspend_user_impl(user_id: UserId) -> Response {
    let c2c_args = user_canister::c2c_set_user_suspended::Args { suspended: false };
    match user_canister_c2c_client::c2c_set_user_suspended(user_id.canister_id(), &c2c_args).await {
        Ok(user_canister::c2c_set_user_suspended::Response::Success(result)) => {
            mutate_state(|state| commit(user_id, result.groups, result.communities, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn commit(user_id: UserId, groups: Vec<ChatId>, communities: Vec<CommunityId>, state: &mut RuntimeState) {
    let now = state.env.now();
    for group in groups {
        state.data.timer_jobs.enqueue_job(
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

    for community in communities {
        state.data.timer_jobs.enqueue_job(
            TimerJob::SetUserSuspendedInCommunity(SetUserSuspendedInCommunity {
                user_id,
                community,
                suspended: false,
                attempt: 0,
            }),
            now,
            now,
        );
    }

    state.data.users.unsuspend_user(user_id, now);

    // Restore whatever privileged roles the account still holds
    crate::model::moderation::sync_suspended_privileges(user_id, false, state);
}
