use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_make_community_private::{Response::*, *};
use types::CommunityId;

#[update_msgpack]
#[trace]
fn c2c_make_community_private(_args: Args) -> Response {
    mutate_state(c2c_make_community_private_impl)
}

fn c2c_make_community_private_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let community_id = CommunityId::from(caller);

    if let Some(community) = runtime_state.data.public_communities.delete(&community_id) {
        runtime_state.data.private_communities.add(community.into());
        Success
    } else {
        CommunityNotFound
    }
}
