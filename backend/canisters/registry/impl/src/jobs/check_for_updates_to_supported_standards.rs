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

    for id in ledger_canister_ids {
        if let Ok(supported_standards) = get_supported_standards(id).await {
            mutate_state(|state| state.data.tokens.set_standards(id, supported_standards, state.env.now()));
        }
    }
}

async fn get_supported_standards(ledger_canister_id: Principal) -> Result<Vec<String>, (RejectionCode, String)> {
    let result = icrc_ledger_canister_c2c_client::icrc1_supported_standards(ledger_canister_id).await?;
    Ok(result.into_iter().map(|r| r.name).collect())
}
