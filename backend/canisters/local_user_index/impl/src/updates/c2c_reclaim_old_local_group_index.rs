use crate::guards::caller_is_group_index;
use crate::model::old_local_group_index::OldLocalGroupIndex;
use crate::{RuntimeState, jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_reclaim_old_local_group_index::*;
use oc_error_codes::OCErrorCode;
use tracing::{error, info};
use types::{CanisterId, OCResult};

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_reclaim_old_local_group_index(args: Args) -> Response {
    mutate_state(|state| c2c_reclaim_old_local_group_index_impl(args, state)).into()
}

fn c2c_reclaim_old_local_group_index_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let old_local_group_index = args.local_group_index_canister_id;
    if old_local_group_index == state.env.canister_id() || is_live(old_local_group_index, state) {
        return Err(OCErrorCode::InvalidRequest.with_message("Not an old LocalGroupIndex"));
    }
    // Only one is ever expected, but once one has been dealt with another can be, which lets the
    // tests, whose environments are reused, each have their own
    if let Some(old) = &state.data.old_local_group_index
        && old.canister_id != old_local_group_index
    {
        if !old.completed {
            return Err(OCErrorCode::AlreadyInProgress.with_message("Already reclaiming a different old LocalGroupIndex"));
        }
        state.data.old_local_group_index = None;
    }
    // Restarting a completed reclaim installs the relay again, which mustn't happen while the old
    // LocalGroupIndex's cycles are being refunded, since that uninstalls whatever code it has
    if state.data.old_local_group_index.as_ref().is_some_and(|old| old.completed)
        && jobs::refund_cycles::is_in_progress(state, old_local_group_index)
    {
        return Err(OCErrorCode::AlreadyInProgress.with_message("The old LocalGroupIndex's cycles are being refunded"));
    }

    // Belt and braces, none of this LocalUserIndex's own canisters should be among them. Any which
    // are, are marked as skipped, which is what they would be if they were only controlled by the
    // old LocalGroupIndex.
    let (live, canister_ids): (Vec<_>, Vec<_>) = args.canister_ids.into_iter().partition(|c| is_live(*c, state));
    for canister_id in &live {
        error!(%canister_id, "Live canister of this LocalUserIndex not reclaimed");
    }

    let old = state
        .data
        .old_local_group_index
        .get_or_insert_with(|| OldLocalGroupIndex::new(old_local_group_index));
    let was_completed = old.completed;
    let queued = old.add(canister_ids);
    for canister_id in live {
        old.mark_skipped(canister_id);
    }

    // Restarted once completed, the old LocalGroupIndex may be waiting to have its cycles refunded,
    // which would uninstall the relay, so it is taken out of the queue until done again
    if was_completed && queued > 0 {
        state
            .data
            .cycles_refund_queue
            .retain(|c| c.canister_id != old_local_group_index);
    }

    info!(%old_local_group_index, queued, "Queued the old LocalGroupIndex's canisters to be reclaimed");
    jobs::reclaim_old_local_group_index::start_job_if_required(state, None);
    Ok(())
}

fn is_live(canister_id: CanisterId, state: &RuntimeState) -> bool {
    state.data.canister_pool.contains(&canister_id)
        || state.data.local_users.contains(&canister_id.into())
        || state.data.local_groups.contains(&canister_id.into())
        || state.data.local_communities.contains(&canister_id.into())
        || state.data.local_multi_user_canisters.contains(&canister_id)
}
