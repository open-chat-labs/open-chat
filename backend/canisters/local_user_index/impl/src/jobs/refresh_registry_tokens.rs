use crate::{mutate_state, read_state};
use constants::HOUR_IN_MS;
use registry_canister::c2c_tokens::Response;
use std::time::Duration;
use tracing::{error, info};
use types::{CanisterId, Empty, Milliseconds};
use utils::canister_timers::run_now_then_interval;

// The tokens are refreshed once they are a day old. Checking hourly means a failed refresh is
// retried within the hour, and that they are refreshed straight away after an upgrade if stale.
const CHECK_INTERVAL: Milliseconds = HOUR_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(CHECK_INTERVAL), run);
}

fn run() {
    let registry_canister_id = read_state(|state| {
        state
            .data
            .registry_canister_id
            .filter(|_| state.data.registry_tokens.is_stale(state.env.now()))
    });
    if let Some(registry_canister_id) = registry_canister_id {
        utils::async_work::spawn_tracked(refresh(registry_canister_id));
    }
}

async fn refresh(registry_canister_id: CanisterId) {
    match registry_canister_c2c_client::c2c_tokens(registry_canister_id, &Empty {}).await {
        // Not taken as a refresh, so that it is retried within the hour, since the Registry always
        // has at least ICP, other than in a test env where it is set up before the ICP ledger
        Ok(Response::Success(tokens)) if tokens.is_empty() => error!("The Registry returned no tokens"),
        Ok(Response::Success(tokens)) => mutate_state(|state| {
            info!(tokens = tokens.len(), "Refreshed the tokens from the Registry");
            let now = state.env.now();
            state.data.registry_tokens.set(tokens, now);
        }),
        Err(error) => error!(?error, "Failed to refresh the tokens from the Registry"),
    }
}
