use crate::updates::c2c_request_cycles::top_up_canister;
use crate::{mutate_state, read_state};
use sns_root_canister::get_sns_canisters_summary::CanisterSummary;
use std::time::Duration;
use types::{CanisterId, Cycles, Empty};
use utils::canister_timers::run_now_then_interval;

const INTERVAL: Duration = Duration::from_secs(24 * 60 * 60); // 1 day
const T: Cycles = 1_000_000_000_000;

pub fn start_job() {
    run_now_then_interval(INTERVAL, run);
}

fn run() {
    if let Some(canister_id) = read_state(|state| state.data.sns_root_canister) {
        ic_cdk::spawn(run_async(canister_id));
    }
}

async fn run_async(canister_id: CanisterId) {
    if let Ok(response) = sns_root_canister_c2c_client::get_sns_canisters_summary(canister_id, &Empty {}).await {
        let canisters: Vec<_> = [
            response.root,
            response.governance,
            response.ledger,
            response.swap,
            response.index,
        ]
        .into_iter()
        .flatten()
        .chain(response.dapps)
        .chain(response.archives)
        .collect();

        // Add SNS canisters to the whitelist
        mutate_state(|state| {
            let now = state.env.now();
            for canister_id in canisters.iter().flat_map(|c| c.canister_id) {
                state.data.canisters.add(canister_id, now);
            }
        });

        let to_top_up: Vec<_> = canisters
            .into_iter()
            .filter(requires_top_up)
            .map(|s| s.canister_id.unwrap())
            .collect();

        if !to_top_up.is_empty() {
            let top_up_amount = read_state(|state| state.data.max_top_up_amount);

            for canister_id in to_top_up {
                let _ = top_up_canister(canister_id, top_up_amount).await;
            }
        }
    }
}

fn requires_top_up(summary: &CanisterSummary) -> bool {
    let cycles: Cycles = summary.status.as_ref().unwrap().cycles.0.clone().try_into().unwrap();

    cycles < 100 * T
}
