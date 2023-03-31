use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::set_neuron_controller_for_initial_airdrop::{Response::*, *};

#[update(guard = "caller_is_openchat_user")]
#[trace]
fn set_neuron_controller_for_initial_airdrop(args: Args) -> Response {
    mutate_state(|state| set_neuron_controller_for_initial_airdrop_impl(args, state))
}

fn set_neuron_controller_for_initial_airdrop_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if !runtime_state.data.initial_airdrop_open {
        AirdropClosed
    } else if let Some(user) = runtime_state.data.users.get(&caller) {
        if user.is_eligible_for_initial_airdrop() {
            runtime_state
                .data
                .neuron_controllers_for_initial_airdrop
                .insert(user.user_id, args.controller);

            Success
        } else {
            UserNotEligible
        }
    } else {
        UserNotFound
    }
}
