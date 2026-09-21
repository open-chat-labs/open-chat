use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::c2c_delete_user::*;
use tracing::info;

// Called by the LocalUserIndex to delete one of this canister's users, in place of the User
// canister being uninstalled
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_delete_user(args: Args) -> Response {
    mutate_state(|state| c2c_delete_user_impl(args, state))
}

// The user is removed, along with their timer jobs, and all of their entries in the stable memory
// map are queued for garbage collection. Their index is never reused, so nothing left over can be
// mistaken for another user's. Other users' copies of direct chats with them are kept, as when a
// User canister is uninstalled. A user who isn't here (eg. because a retried call already deleted
// them) is treated as deleted, as `c2c_groups_and_communities`, which the LocalUserIndex calls
// first, also does.
fn c2c_delete_user_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(user_index) = state.local_user_index(args.user_id) else {
        return Response::Success;
    };

    state.data.users.remove(user_index);
    state.data.timer_jobs.cancel_jobs(|job| job.user_index() == user_index);
    // Nor are any events from them still waiting to be sent to the LocalUserIndex, as when a User
    // canister is uninstalled
    state
        .data
        .local_user_index_event_sync_queue
        .retain(|event| event.value.user_id != args.user_id);
    // The user's whole scope is garbage collected, so there is no need to remove these separately
    state
        .data
        .stable_memory_keys_to_garbage_collect
        .retain(|(index, _)| *index != user_index);
    state.data.deleted_users_to_garbage_collect.push(user_index);
    jobs::garbage_collect_stable_memory::start_job_if_required(&state.data);

    info!(user_id = %args.user_id, "User deleted");
    Response::Success
}
