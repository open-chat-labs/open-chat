use crate::{RuntimeState, read_state};
use types::{C2CError, UserId};
use utils::canister::is_user_canister_possibly_migrated;

mod calculate_hot_groups;
mod calculate_hotness;
mod calculate_metrics;
pub mod push_community_deleted_notifications;
pub mod push_group_deleted_notifications;

pub(crate) fn start(state: &RuntimeState) {
    calculate_metrics::start_job();
    calculate_hot_groups::start_job();
    calculate_hotness::start_job();
    push_community_deleted_notifications::start_job_if_required(state);
    push_group_deleted_notifications::start_job_if_required(state);
}

// The user's latest id, if the call to their canister failed in a way it does once they have been
// migrated (see `is_user_canister_possibly_migrated`) and the UserIndex says they have been migrated
// to a MultiUser canister since having `user_id`. If the lookup fails, the call is retried as usual.
async fn latest_id_if_migrated(user_id: UserId, error: &C2CError) -> Option<UserId> {
    if !is_user_canister_possibly_migrated(error) {
        return None;
    }

    let user_index_canister_id = read_state(|state| state.data.user_index_canister_id);
    user_index_canister_c2c_client::lookup_migrated_user_id(user_id, user_index_canister_id)
        .await
        .ok()
        .flatten()
}
