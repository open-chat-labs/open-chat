use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_update_community::{Response::*, *};
use types::CommunityId;

#[update_msgpack]
#[trace]
fn c2c_update_community(args: Args) -> Response {
    mutate_state(|state| c2c_update_community_impl(args, state))
}

fn c2c_update_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    let community_id = CommunityId::from(state.env.caller());

    if let Some(community) = state.data.public_communities.get(&community_id) {
        if community.name() != args.name {
            if state.data.public_group_and_community_names.is_name_taken(&args.name) {
                return NameTaken;
            }

            state
                .data
                .public_group_and_community_names
                .remove(community.name(), community_id.into());

            state
                .data
                .public_group_and_community_names
                .insert(&args.name, community_id.into());
        }

        state.data.public_communities.update_community(
            &community_id,
            args.name,
            args.description,
            args.avatar_id,
            args.banner_id,
            args.gate,
        );
        Success
    } else {
        CommunityNotFound
    }
}
