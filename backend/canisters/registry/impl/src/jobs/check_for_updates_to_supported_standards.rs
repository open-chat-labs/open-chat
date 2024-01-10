use crate::{mutate_state, read_state};
use candid::Principal;
use ic_cdk::api::call::RejectionCode;
use std::time::Duration;
use utils::canister_timers::run_now_then_interval;
use utils::time::HOUR_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(12 * HOUR_IN_MS), run);
}

fn run() {
    ic_cdk::spawn(run_async());
}

async fn run_async() {
    let ledger_canister_ids: Vec<_> =
        read_state(|state| state.data.tokens.get_all().iter().map(|t| t.ledger_canister_id).collect());

    futures::future::join_all(ledger_canister_ids.into_iter().map(get_supported_standards)).await;
}

async fn get_supported_standards(ledger: Principal) -> Result<(), (RejectionCode, String)> {
    let result = icrc_ledger_canister_c2c_client::icrc1_supported_standards(ledger).await?;
    let standards = result.into_iter().map(|r| r.name).collect();
    mutate_state(|state| state.data.tokens.set_standards(ledger, standards, state.env.now()));
    Ok(())
}
