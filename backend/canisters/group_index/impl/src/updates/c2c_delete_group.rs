use crate::guards::caller_is_group_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_delete_group::{Response::*, *};
use types::{ChatId, CommunityImportedInto, DeletedGroupInfoInternal, UserId};

#[update_msgpack(guard = "caller_is_group_canister")]
#[trace]
fn c2c_delete_group(args: Args) -> Response {
    mutate_state(|state| {
        delete_group(
            state.env.caller().into(),
            args.group_name,
            args.deleted_by,
            args.members,
            None,
            state,
        )
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
    if let Some(local_group_index_canister) = state.data.local_index_map.get_index_canister_for_group(&group_id) {
        state.data.fire_and_forget_handler.send(
            local_group_index_canister,
            "c2c_delete_group_msgpack".to_string(),
            msgpack::serialize_then_unwrap(local_group_index_canister::c2c_delete_group::Args { chat_id: group_id }),
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

    state.data.deleted_groups.insert(
        DeletedGroupInfoInternal {
            id: group_id,
            timestamp: state.env.now(),
            deleted_by,
            group_name: group_name.clone(),
            name: group_name,
            public,
            community_imported_into,
        },
        members,
    );
    crate::jobs::push_group_deleted_notifications::start_job_if_required(state);

    Success
}
