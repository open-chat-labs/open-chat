use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_make_community_private::{Response::*, *};
use types::CommunityId;

#[update(msgpack = true)]
#[trace]
fn c2c_make_community_private(_args: Args) -> Response {
    mutate_state(c2c_make_community_private_impl)
}

fn c2c_make_community_private_impl(state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let community_id = CommunityId::from(caller);

    if let Some(community) = state.data.public_communities.delete(&community_id) {
        state
            .data
            .public_group_and_community_names
            .remove(community.name(), community_id.into());
        state.data.private_communities.add(community.into());
        Success
    } else {
        CommunityNotFound
    }
}
