use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_update_community::{Response::*, *};
use types::CommunityId;

#[update(msgpack = true)]
#[trace]
fn c2c_update_community(args: Args) -> Response {
    mutate_state(|state| c2c_update_community_impl(args, state))
}

fn c2c_update_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    let community_id = CommunityId::from(state.env.caller());

    if let Some(community) = state.data.public_communities.get(&community_id) {
        if community.name().to_uppercase() != args.name.to_uppercase() {
            if state.data.public_group_and_community_names.is_name_taken(&args.name) {
                return NameTaken;
            }

            state
                .data
                .public_group_and_community_names
                .rename(community.name(), &args.name, community_id.into());
        }

        state.data.public_communities.update_community(
            &community_id,
            args.name,
            args.description,
            args.avatar_id,
            args.banner_id,
            args.gate_config,
        );
        Success
    } else if let Some(community) = state.data.private_communities.get(&community_id) {
        if state.data.public_group_and_community_names.is_name_taken(&args.name) {
            return NameTaken;
        }

        let date_created = community.created();

        state.data.private_communities.delete(&community_id);
        state
            .data
            .public_group_and_community_names
            .insert(&args.name, community_id.into());

        state.data.public_communities.add(
            community_id,
            args.name,
            args.description,
            args.avatar_id,
            args.banner_id,
            args.gate_config,
            args.primary_language,
            args.channel_count,
            date_created,
        );
        Success
    } else {
        CommunityNotFound
    }
}
