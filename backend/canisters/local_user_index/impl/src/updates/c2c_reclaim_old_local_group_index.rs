use crate::guards::caller_is_group_index;
use crate::model::old_local_group_index::OldLocalGroupIndex;
use crate::{RuntimeState, jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_reclaim_old_local_group_index::*;
use oc_error_codes::OCErrorCode;
use tracing::info;
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

    // Belt and braces, none of this LocalUserIndex's own canisters should be among them
    let canister_ids: Vec<_> = args.canister_ids.into_iter().filter(|c| !is_live(*c, state)).collect();

    let queued = state
        .data
        .old_local_group_index
        .get_or_insert_with(|| OldLocalGroupIndex::new(old_local_group_index))
        .add(canister_ids);

    info!(%old_local_group_index, queued, "Queued the old LocalGroupIndex's canisters to be reclaimed");
    jobs::reclaim_old_local_group_index::start_job_if_required(state, None);
    Ok(())
}

fn is_live(canister_id: CanisterId, state: &RuntimeState) -> bool {
    state.data.local_users.contains(&canister_id.into())
        || state.data.local_groups.contains(&canister_id.into())
        || state.data.local_communities.contains(&canister_id.into())
        || state.data.local_multi_user_canisters.contains(&canister_id)
}
