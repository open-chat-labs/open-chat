use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::is_eligible_for_initial_airdrop::{Response::*, *};

#[query]
fn is_eligible_for_initial_airdrop(_args: Args) -> Response {
    read_state(is_eligible_for_initial_airdrop_impl)
}

fn is_eligible_for_initial_airdrop_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if !runtime_state.data.initial_airdrop_open {
        AirdropClosed
    } else if let Some(u) = runtime_state.data.users.get_by_principal(&caller) {
        if u.is_eligible_for_initial_airdrop() {
            Yes(runtime_state
                .data
                .neuron_controllers_for_initial_airdrop
                .get(&u.user_id)
                .copied())
        } else {
            No
        }
    } else {
        UserNotFound
    }
}
