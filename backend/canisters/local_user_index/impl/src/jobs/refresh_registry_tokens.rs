use crate::{mutate_state, read_state};
use constants::DAY_IN_MS;
use registry_canister::c2c_tokens::Response;
use std::time::Duration;
use tracing::{error, info};
use types::{CanisterId, Empty};
use utils::canister_timers::run_now_then_interval;

// Refreshes the tokens on start (so after every upgrade) and then daily. A failed refresh leaves
// the previous tokens in place until the next.
pub fn start_job() {
    run_now_then_interval(Duration::from_millis(DAY_IN_MS), run);
}

fn run() {
    if let Some(registry_canister_id) = read_state(|state| state.data.registry_canister_id) {
        utils::async_work::spawn_tracked(refresh(registry_canister_id));
    }
}

async fn refresh(registry_canister_id: CanisterId) {
    match registry_canister_c2c_client::c2c_tokens(registry_canister_id, &Empty {}).await {
        Ok(Response::Success(tokens)) => mutate_state(|state| {
            info!(tokens = tokens.len(), "Refreshed the tokens from the Registry");
            state.data.registry_tokens.set(tokens);
        }),
        Err(error) => error!(?error, "Failed to refresh the tokens from the Registry"),
    }
}
