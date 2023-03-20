use crate::jobs::top_up_sns_canisters::get_sns_canisters_summary::CanisterSummary;
use crate::read_state;
use std::time::Duration;
use types::{CanisterId, Cycles, Empty};
use utils::canister::deposit_cycles;

const INTERVAL: Duration = Duration::from_secs(24 * 60 * 60); // 1 day
const T: Cycles = 1_000_000_000_000;

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(INTERVAL, run);

    // Run the job now so that there is never a gap of more than 1 day.
    ic_cdk_timers::set_timer(Duration::default(), run);
}

fn run() {
    if let Some(canister_id) = read_state(|state| state.data.sns_root_canister) {
        ic_cdk::spawn(run_async(canister_id));
    }
}

async fn run_async(canister_id: CanisterId) {
    if let Ok(response) = get_sns_canisters_summary(canister_id, &Empty {}).await {
        let to_top_up: Vec<_> = vec![
            response.root,
            response.governance,
            response.ledger,
            response.swap,
            response.index,
        ]
        .into_iter()
        .flatten()
        .chain(response.archives)
        .filter(requires_top_up)
        .map(|s| s.canister_id.unwrap())
        .collect();

        if !to_top_up.is_empty() {
            let top_up_amount = read_state(|state| state.data.max_top_up_amount);

            for canister_id in to_top_up {
                let _ = deposit_cycles(canister_id, top_up_amount).await;
            }
        }
    }
}

fn requires_top_up(summary: &CanisterSummary) -> bool {
    let cycles: Cycles = summary.status.as_ref().unwrap().cycles.0.clone().try_into().unwrap();

    cycles < 100 * T
}

canister_client::generate_candid_c2c_call!(get_sns_canisters_summary);

pub mod get_sns_canisters_summary {
    use candid::{CandidType, Nat, Principal};
    use serde::Deserialize;
    use types::Empty;

    pub type Args = Empty;

    #[derive(CandidType, Deserialize, Debug)]
    pub struct Response {
        pub root: Option<CanisterSummary>,
        pub governance: Option<CanisterSummary>,
        pub ledger: Option<CanisterSummary>,
        pub swap: Option<CanisterSummary>,
        pub archives: Vec<CanisterSummary>,
        pub index: Option<CanisterSummary>,
    }

    #[derive(CandidType, Deserialize, Debug)]
    pub struct CanisterSummary {
        pub canister_id: Option<Principal>,
        pub status: Option<CanisterStatusResult>,
    }

    #[derive(CandidType, Deserialize, Debug)]
    pub struct CanisterStatusResult {
        pub cycles: Nat,
    }
}
