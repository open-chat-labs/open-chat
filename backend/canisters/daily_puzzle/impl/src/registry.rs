use crate::{mutate_state, read_state};
use constants::MINUTE_IN_MS;
use registry_canister::subnets;
use tracing::error;
use types::{C2CError, Empty};

mod client {
    use registry_canister::subnets;

    canister_client::generate_candid_c2c_call!(subnets);
}

/// Replaces `local_user_indexes` with the registry's current set.
pub async fn refresh_local_user_indexes() -> Result<(), C2CError> {
    let registry_canister_id = read_state(|state| state.data.registry_canister_id);
    let subnets::Response::Success(subnets) = client::subnets(registry_canister_id, &Empty {}).await?;
    mutate_state(|state| {
        state.data.local_user_indexes = subnets.iter().map(|s| s.local_user_index).collect();
        state.data.last_registry_refresh = state.env.now();
    });
    Ok(())
}

pub async fn refresh_local_user_indexes_if_stale() {
    let stale = read_state(|state| state.env.now().saturating_sub(state.data.last_registry_refresh) > MINUTE_IN_MS);
    if stale && let Err(error) = refresh_local_user_indexes().await {
        error!(?error, "Failed to refresh local user indexes from the registry");
    }
}
