use crate::updates::add_token::add_sns_token;
use crate::{mutate_state, read_state};
use ic_cdk::api::management_canister::main::CanisterId;
use std::collections::HashSet;
use std::time::Duration;
use tracing::info;
use types::Empty;
use utils::time::HOUR_IN_MS;

const LIFECYCLE_COMMITTED: i32 = 3;
const LIFECYCLE_ABORTED: i32 = 4;

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(Duration::from_millis(HOUR_IN_MS), run);
    ic_cdk_timers::set_timer(Duration::ZERO, run);
}

fn run() {
    ic_cdk::spawn(run_async());
}

async fn run_async() {
    let sns_wasm_canister_id = read_state(|state| state.data.sns_wasm_canister_id);

    if let Ok(response) = sns_wasm_canister_c2c_client::list_deployed_snses(sns_wasm_canister_id, &Empty {}).await {
        let unknown_snses: Vec<_> = read_state(|state| {
            let known_snses: HashSet<_> = state
                .data
                .tokens
                .get_all()
                .iter()
                .flat_map(|t| t.nervous_system.as_ref())
                .map(|ns| ns.root)
                .chain(state.data.failed_sns_launches.iter().copied())
                .collect();

            response
                .instances
                .into_iter()
                .filter(|sns| !known_snses.contains(&sns.root_canister_id.unwrap()))
                .collect()
        });

        for sns in unknown_snses {
            let root_canister_id = sns.root_canister_id.unwrap();
            info!(%root_canister_id, "Getting details of unknown SNS");
            if let Some(success) = is_successfully_launched(sns.swap_canister_id.unwrap()).await {
                if success {
                    add_sns_token(
                        sns.ledger_canister_id.unwrap(),
                        root_canister_id,
                        sns.governance_canister_id.unwrap(),
                    )
                    .await;
                } else {
                    info!(%root_canister_id, "Recording failed SNS launch");
                    mutate_state(|state| state.data.failed_sns_launches.insert(root_canister_id));
                }
            }
        }
    }
}

async fn is_successfully_launched(sns_swap_canister_id: CanisterId) -> Option<bool> {
    if let Ok(response) = sns_swap_canister_c2c_client::get_lifecycle(sns_swap_canister_id, &Empty {}).await {
        match response.lifecycle {
            Some(LIFECYCLE_COMMITTED) => Some(true),
            Some(LIFECYCLE_ABORTED) => Some(false),
            _ => None,
        }
    } else {
        None
    }
}
