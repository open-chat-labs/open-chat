use crate::guards::caller_is_community_canister;
use crate::updates::c2c_delete_group::delete_group;
use crate::updates::c2c_mark_community_active::c2c_mark_community_active_impl;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use group_index_canister::c2c_mark_group_import_complete::{Response::*, *};
use types::{CommunityId, CommunityImportedInto};

#[update(guard = "caller_is_community_canister", msgpack = true)]
#[trace]
fn c2c_mark_group_import_complete(args: Args) -> Response {
    mutate_state(|state| c2c_mark_group_import_complete_impl(args, state))
}

fn c2c_mark_group_import_complete_impl(args: Args, state: &mut RuntimeState) -> Response {
    let community_id: CommunityId = state.env.caller().into();

    c2c_mark_community_active_impl(args.mark_active_duration, args.public_community_activity, state);

    delete_group(
        args.group_id,
        args.group_name,
        OPENCHAT_BOT_USER_ID,
        args.members,
        Some(CommunityImportedInto {
            community_name: args.community_name,
            community_id,
            local_user_index_canister_id: args.local_user_index_canister_id,
            channel: args.channel,
            other_default_channels: args.other_public_channels,
        }),
        state,
    );

    Success
}
