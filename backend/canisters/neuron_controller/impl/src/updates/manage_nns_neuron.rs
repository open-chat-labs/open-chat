use crate::ecdsa::make_canister_call_via_ecdsa;
use crate::guards::caller_is_governance_principal;
use crate::jobs::process_neurons::process_neurons;
use crate::mutate_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use neuron_controller_canister::manage_nns_neuron::{Response::*, *};
use nns_governance_canister::types::ManageNeuron;
use nns_governance_canister::types::manage_neuron::Command;
use std::time::Duration;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn manage_nns_neuron(args: Args) -> Response {
    manage_nns_neuron_impl(args.neuron_id, args.command).await
}

pub(crate) async fn manage_nns_neuron_impl(neuron_id: u64, command: Command) -> Response {
    let request = mutate_state(|state| {
        state.prepare_canister_call_via_ecdsa(
            state.data.nns_governance_canister_id,
            "manage_neuron".to_string(),
            ManageNeuron::new(neuron_id, command),
        )
    });

    match make_canister_call_via_ecdsa(request).await {
        Ok(response) => {
            ic_cdk_timers::set_timer(Duration::from_secs(60), process_neurons);
            Success(response)
        }
        Err(error) => InternalError(error),
    }
}
