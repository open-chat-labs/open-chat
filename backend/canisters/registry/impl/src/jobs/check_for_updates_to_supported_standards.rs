use crate::{mutate_state, read_state};
use constants::HOUR_IN_MS;
use std::time::Duration;
use types::{C2CError, CanisterId};
use utils::canister_timers::run_now_then_interval;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(13 * HOUR_IN_MS), run);
}

fn run() {
    ic_cdk::futures::spawn(run_async());
}

async fn run_async() {
    let ledger_canister_ids: Vec<_> = read_state(|state| {
        state
            .data
            .tokens
            .iter()
            .filter(|t| !t.uninstalled)
            .map(|t| t.ledger_canister_id)
            .collect()
    });

    futures::future::join_all(ledger_canister_ids.into_iter().map(get_supported_standards)).await;
}

async fn get_supported_standards(ledger: CanisterId) -> Result<(), C2CError> {
    let result = icrc_ledger_canister_c2c_client::icrc1_supported_standards(ledger).await?;
    let standards: Vec<_> = result.into_iter().map(|r| r.name).collect();
    let supports_icrc106 = standards.iter().any(|s| s == "ICRC-106");

    let should_fetch_index = mutate_state(|state| {
        state.data.tokens.set_standards(ledger, standards, state.env.now());

        supports_icrc106 && state.data.tokens.get(ledger).is_some_and(|t| t.index_canister_id.is_none())
    });

    if should_fetch_index
        && let Ok(Ok(index_canister_id)) = icrc_ledger_canister_c2c_client::icrc106_index_canister_principal(ledger).await
    {
        mutate_state(|state| {
            state
                .data
                .tokens
                .set_index_canister(ledger, index_canister_id, state.env.now())
        });
    }

    Ok(())
}
