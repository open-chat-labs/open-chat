use crate::guards::caller_is_community_canister;
use crate::updates::c2c_delete_group::delete_group;
use crate::updates::c2c_mark_community_active::c2c_mark_community_active_impl;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_mark_group_import_complete::{Response::*, *};
use types::{CommunityId, CommunityImportedInto};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update_msgpack(guard = "caller_is_community_canister")]
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
            channel_id: args.channel_id,
        }),
        state,
    );

    Success
}
