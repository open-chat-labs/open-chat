use crate::guards::caller_is_community_canister;
use crate::updates::c2c_delete_group::delete_group;
use crate::updates::c2c_mark_community_active::mark_community_active;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use group_index_canister::GroupImportComplete;
use group_index_canister::c2c_mark_group_import_complete::*;
use types::{CanisterId, CommunityId, CommunityImportedInto};

#[update(guard = "caller_is_community_canister", msgpack = true)]
#[trace]
fn c2c_mark_group_import_complete(args: Args) -> Response {
    mutate_state(|state| {
        let community_id: CommunityId = state.env.caller().into();
        mark_group_import_complete(
            GroupImportComplete {
                community_id,
                community_name: args.community_name,
                channel: args.channel,
                group_id: args.group_id,
                group_name: args.group_name,
                members: args.members,
                other_public_channels: args.other_public_channels,
                mark_active_duration: args.mark_active_duration,
                public_community_activity: args.public_community_activity,
            },
            args.local_user_index_canister_id,
            state,
        )
    })
}

// `local_user_index_canister_id` is the LocalUserIndex holding the community, at which the group's
// members now reach the channel the group became
pub(crate) fn mark_group_import_complete(
    ev: GroupImportComplete,
    local_user_index_canister_id: CanisterId,
    state: &mut RuntimeState,
) -> Response {
    mark_community_active(ev.community_id, ev.mark_active_duration, ev.public_community_activity, state);

    delete_group(
        ev.group_id,
        ev.group_name,
        OPENCHAT_BOT_USER_ID,
        ev.members,
        Some(CommunityImportedInto {
            community_name: ev.community_name,
            community_id: ev.community_id,
            local_user_index_canister_id,
            channel: ev.channel,
            other_default_channels: ev.other_public_channels,
        }),
        state,
    );

    Response::Success
}
