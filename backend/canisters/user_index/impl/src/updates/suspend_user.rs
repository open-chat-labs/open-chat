use crate::guards::caller_is_platform_moderator;
use crate::model::moderation;
use crate::timer_job_types::{SetUserSuspendedInCommunity, SetUserSuspendedInGroup, TimerJob, UnsuspendUser};
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use local_user_index_canister::{UserIndexEvent, UserSuspended};
use tracing::info;
use types::{ChatId, CommunityId, Milliseconds, SuspensionDuration, UserId};
use user_index_canister::suspend_user::{Response::*, *};

#[update(guard = "caller_is_platform_moderator", msgpack = true)]
#[trace]
async fn suspend_user(args: Args) -> Response {
    let suspended_by = match read_state(|state| prepare(&args.user_id, state)) {
        Err(response) => return response,
        Ok(ok) => ok,
    };

    // A moderator's own action, never a downgrade of one
    suspend_user_impl(args.user_id, args.duration, args.reason, suspended_by, false, None).await
}

pub(crate) async fn suspend_user_impl(
    user_id: UserId,
    duration: Option<Milliseconds>,
    reason: String,
    suspended_by: UserId,
    downgrade: bool,
    caused_by_report: Option<u64>,
) -> Response {
    let c2c_args = user_canister::c2c_set_user_suspended::Args { suspended: true };
    match user_canister_c2c_client::c2c_set_user_suspended(user_id.into(), &c2c_args).await {
        Ok(user_canister::c2c_set_user_suspended::Response::Success(result)) => {
            mutate_state(|state| {
                commit(
                    user_id,
                    duration,
                    reason,
                    result.groups,
                    result.communities,
                    suspended_by,
                    downgrade,
                    caused_by_report,
                    state,
                )
            });
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn prepare(user_id: &UserId, state: &RuntimeState) -> Result<UserId, Response> {
    match state.data.users.is_user_suspended(user_id) {
        Some(false) => {
            let caller = state.env.caller();
            Ok(state.data.users.get_by_principal(&caller).unwrap().user_id)
        }
        Some(true) => Err(UserAlreadySuspended),
        None => Err(UserNotFound),
    }
}

#[allow(clippy::too_many_arguments)]
fn commit(
    user_id: UserId,
    duration: Option<Milliseconds>,
    reason: String,
    groups: Vec<ChatId>,
    communities: Vec<CommunityId>,
    suspended_by: UserId,
    downgrade: bool,
    caused_by_report: Option<u64>,
    state: &mut RuntimeState,
) {
    let now = state.env.now();

    // I1a, re-checked at the write rather than only where the job was enqueued: the two are
    // separated by the timer tick and the c2c call above, and a manual suspension applied in
    // that gap must not be overwritten by an automated one. Safe to abandon the suspension
    // here: `c2c_set_user_suspended(true)` is idempotent and the user is already suspended,
    // so the user canister and this one still agree.
    //
    // A downgrade is the one automated path which deliberately replaces an indefinite
    // suspension with a lesser one, so it fails the escalation rule by design: all it must
    // re-confirm is that the suspension it is about to replace is not a manual one.
    if suspended_by == OPENCHAT_BOT_USER_ID {
        // I1b: a human verdict recorded while this job was in flight supersedes it - the
        // verdict arms are the sole authority for post-verdict sanctions. Without this, a
        // detection suspension delayed by the c2c round trip (or its 30s retries) commits
        // AFTER the verdict's downgrade or unsuspension and silently overwrites it.
        if let Some(report_index) = caused_by_report
            && state
                .data
                .reported_messages
                .get(report_index)
                .is_some_and(|r| r.human_verdict().is_some())
        {
            info!(%user_id, report_index, "Skipping automated suspension: its report was resolved while it was in flight");
            return;
        }
        let permitted = if downgrade {
            !moderation::has_manual_suspension(user_id, state)
        } else {
            moderation::automated_suspension_applies(user_id, duration, state)
        };
        if !permitted {
            info!(%user_id, downgrade, "Skipping automated suspension: a manual or stronger suspension is in force");
            return;
        }
    }

    for group in groups {
        state.data.timer_jobs.enqueue_job(
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

    for community in communities {
        state.data.timer_jobs.enqueue_job(
            TimerJob::SetUserSuspendedInCommunity(SetUserSuspendedInCommunity {
                user_id,
                community,
                suspended: true,
                attempt: 0,
            }),
            now,
            now,
        );
    }

    state
        .data
        .users
        .suspend_user(user_id, duration, reason.clone(), suspended_by, now);

    // If the user is only suspended for a specified duration, schedule them to be unsuspended.
    // The job carries this suspension's timestamp so that it expires only this suspension: by
    // the time it fires the user can be serving a different (eg. indefinite) one.
    if let Some(ms) = duration {
        state.data.timer_jobs.enqueue_job(
            TimerJob::UnsuspendUser(UnsuspendUser {
                user_id,
                expected_suspension_timestamp: Some(now),
                attempt: 0,
                restoration_report_index: None,
            }),
            now + ms,
            now,
        );
    }

    state.push_event_to_local_user_index(
        user_id,
        UserIndexEvent::UserSuspended(UserSuspended {
            user_id,
            timestamp: now,
            duration: duration.map_or(SuspensionDuration::Indefinitely, SuspensionDuration::Duration),
            reason,
            suspended_by,
        }),
    );
}
