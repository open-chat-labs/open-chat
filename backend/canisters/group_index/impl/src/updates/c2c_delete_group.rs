use crate::guards::caller_is_group_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_delete_group::{Response::*, *};
use types::{ChatId, CommunityImportedInto, DeletedGroupInfo, UserId};

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

    let public = state.data.public_groups.delete(&group_id).is_some();
    if !public {
        state.data.private_groups.delete(&group_id);
    }

    state.data.deleted_groups.insert(
        DeletedGroupInfo {
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

    Success
}
