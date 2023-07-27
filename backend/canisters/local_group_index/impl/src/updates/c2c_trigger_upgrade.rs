use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_trigger_upgrade::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_trigger_upgrade(_args: Args) -> Response {
    mutate_state(c2c_trigger_upgrade_impl)
}

fn c2c_trigger_upgrade_impl(state: &mut RuntimeState) -> Response {
    let canister_id = state.env.caller();

    if state.data.local_groups.get(&canister_id.into()).is_some() {
        state.data.groups_requiring_upgrade.enqueue(canister_id);
    } else if state.data.local_communities.get(&canister_id.into()).is_some() {
        state.data.communities_requiring_upgrade.enqueue(canister_id);
    }
    Success
}
