use crate::{mutate_state, read_state, RuntimeState};
use ic_cdk_timers::TimerId;
use sns_governance_canister::types::manage_neuron::configure::Operation;
use sns_governance_canister::types::manage_neuron::IncreaseDissolveDelay;
use sns_governance_canister_c2c_client::configure_neuron;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, SnsNeuronId};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && state
            .data
            .nervous_systems
            .get_neuron_in_need_of_dissolve_delay_increase()
            .is_some()
    {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    trace!("'increase_dissolve_delay' job running");
    TIMER_ID.set(None);

    if let Some(neuron) = mutate_state(|state| state.data.nervous_systems.get_neuron_in_need_of_dissolve_delay_increase()) {
        ic_cdk::futures::spawn(increase_dissolve_delay(
            neuron.governance_canister_id,
            neuron.neuron_id,
            neuron.additional_dissolve_delay_seconds,
        ));
    }
}

async fn increase_dissolve_delay(
    governance_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    additional_dissolve_delay_seconds: u32,
) {
    if configure_neuron(
        governance_canister_id,
        neuron_id,
        Operation::IncreaseDissolveDelay(IncreaseDissolveDelay {
            additional_dissolve_delay_seconds,
        }),
    )
    .await
    .is_ok()
    {
        mutate_state(|state| {
            state
                .data
                .nervous_systems
                .mark_neuron_dissolve_delay_increased(&governance_canister_id, additional_dissolve_delay_seconds as u64 * 1000)
        });
    }
    read_state(start_job_if_required);
}
