use crate::{mutate_state, read_state};
use nns_governance_canister::types::ListNeurons;
use std::time::Duration;
use types::{Milliseconds, Timestamped};
use utils::canister_timers::run_now_then_interval;
use utils::time::DAY_IN_MS;

const REFRESH_NEURONS_INTERVAL: Milliseconds = DAY_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(REFRESH_NEURONS_INTERVAL), run);
}

fn run() {
    ic_cdk::spawn(run_async());
}

async fn run_async() {
    let nns_governance_canister_id = read_state(|state| state.data.nns_governance_canister_id);

    if let Ok(response) = nns_governance_canister_c2c_client::list_neurons(
        nns_governance_canister_id,
        &ListNeurons {
            neuron_ids: Vec::new(),
            include_neurons_readable_by_caller: true,
        },
    )
    .await
    {
        mutate_state(|state| {
            let now = state.env.now();
            state.data.neurons = Timestamped::new(response.full_neurons, now);
        });
    }
}
