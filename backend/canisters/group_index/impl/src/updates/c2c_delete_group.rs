use crate::StorageIndexEvent;
use crate::guards::caller_is_group_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_delete_group::*;
use multi_user_canister::GroupIndexEvent;
use tracing::info;
use types::{ChatId, CommunityImportedInto, DeletedGroupInfoInternal, UserId};
use utils::cycles::accept_cycles;

#[update(guard = "caller_is_group_canister", msgpack = true)]
#[trace]
fn c2c_delete_group(args: Args) -> Response {
    mutate_state(|state| {
        let group_id = state.env.caller().into();

        let cycles = accept_cycles();
        if cycles > 0 {
            info!(cycles, %group_id, "Group refunded cycles when being deleted");
        }

        delete_group(group_id, args.group_name, args.deleted_by, args.members, None, state)
    })
}

pub(crate) fn delete_group(
    group_id: ChatId,
    group_name: String,
    deleted_by: UserId,
    members: Vec<UserId>,
    community_imported_into: Option<CommunityImportedInto>,
    state: &mut RuntimeState,
) -> Response {
    if let Some(local_user_index_canister) = state.data.local_index_map.get_index_canister_for_group(&group_id) {
        state.data.fire_and_forget_handler.send(
            local_user_index_canister,
            "c2c_delete_group_msgpack".to_string(),
            msgpack::serialize_then_unwrap(local_user_index_canister::c2c_delete_group::Args { chat_id: group_id }),
        );
    }

    let public = if let Some(group) = state.data.public_groups.delete(&group_id) {
        // This won't remove the name if the group was converted into a community because the name
        // will now be assigned to the community
        state
            .data
            .public_group_and_community_names
            .remove(group.name(), group_id.into());
        true
    } else {
        state.data.private_groups.delete(&group_id);
        false
    };

    // The files sent in the group name it as their only accessor, so removing it removes them. A group
    // imported into a community lives on as one of its channels, so its files are kept until the
    // community is deleted.
    if community_imported_into.is_none() {
        state.push_event_to_storage_index(StorageIndexEvent::RemoveAccessor(group_id.into()), state.env.now());
    }

    state.data.local_index_map.mark_group_deleted(&group_id);

    let now = state.env.now();
    let deleted_group = DeletedGroupInfoInternal {
        id: group_id,
        timestamp: now,
        deleted_by,
        group_name: group_name.clone(),
        name: group_name,
        public,
        community_imported_into,
    };
    if state.data.deleted_groups.insert(deleted_group.clone()) {
        // Each member other than the deleter is told, via their canister
        state.push_event_to_users(
            members.into_iter().filter(|u| *u != deleted_by),
            GroupIndexEvent::GroupDeleted(Box::new(deleted_group)),
            now,
        );
    }

    Response::Success
}
