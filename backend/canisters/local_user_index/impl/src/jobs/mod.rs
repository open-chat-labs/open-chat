use crate::{RuntimeState, read_state};
use ic_cdk::management_canister::ClearChunkStoreArgs;
use tracing::info;

pub mod delete_users;
pub mod topup_canister_pool;
pub mod topup_canisters;
pub mod upgrade_communities;
pub mod upgrade_groups;
pub mod upgrade_users;

pub(crate) fn start(state: &RuntimeState) {
    delete_users::start_job_if_required(state, None);
    topup_canister_pool::start_job_if_required(state, None);
    topup_canisters::start_job();
    upgrade_communities::start_job_if_required(state);
    upgrade_groups::start_job_if_required(state);
    upgrade_users::start_job_if_required(state);
}

fn clear_chunk_store_if_no_pending_upgrades() {
    if let Some(canister_id) = read_state(|state| {
        let should_clear_chunk_store = state.data.users_requiring_upgrade.is_empty()
            && state.data.groups_requiring_upgrade.is_empty()
            && state.data.communities_requiring_upgrade.is_empty();

        if should_clear_chunk_store { Some(state.env.canister_id()) } else { None }
    }) {
        ic_cdk::futures::spawn(async move {
            ic_cdk::management_canister::clear_chunk_store(&ClearChunkStoreArgs { canister_id })
                .await
                .unwrap();

            info!("Chunk store cleared");
        });
    }
}
