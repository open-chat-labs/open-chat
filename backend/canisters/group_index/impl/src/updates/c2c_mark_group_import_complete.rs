use crate::RuntimeState;
use crate::updates::c2c_delete_group::delete_group;
use crate::updates::c2c_mark_community_active::mark_community_active;
use constants::OPENCHAT_BOT_USER_ID;
use group_index_canister::GroupImportComplete;
use types::{CanisterId, CommunityImportedInto};

// `local_user_index_canister_id` is the LocalUserIndex holding the community, at which the group's
// members now reach the channel the group became
pub(crate) fn mark_group_import_complete(
    ev: GroupImportComplete,
    local_user_index_canister_id: CanisterId,
    state: &mut RuntimeState,
) {
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
}
