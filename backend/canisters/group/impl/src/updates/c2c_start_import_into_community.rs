use crate::guards::caller_is_group_index_or_local_group_index;
use crate::updates::c2c_freeze_group::freeze_group_impl;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_start_import_into_community::{Response::*, *};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update_msgpack(guard = "caller_is_group_index_or_local_group_index")]
#[trace]
fn c2c_start_import_into_community(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_start_import_into_community_impl(args, state))
}

fn c2c_start_import_into_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(member) = state.data.chat.members.get_mut(&args.user_id) {
        if member.suspended.value {
            UserSuspended
        } else if !member.role.is_owner() {
            UserNotGroupOwner
        } else if state.data.community_being_imported_into.is_some() {
            AlreadyImportingToAnotherCommunity
        } else if state.data.is_frozen() {
            ChatFrozen
        } else {
            state.data.community_being_imported_into = Some(args.community_id);
            let serialized = msgpack::serialize_then_unwrap(&state.data.chat);
            let total_bytes = serialized.len() as u64;
            state.data.serialized_chat_state = Some(serialized);

            freeze_group_impl(
                OPENCHAT_BOT_USER_ID,
                Some("Chat is being imported into a community".to_string()),
                false,
                state,
            );

            Success(total_bytes)
        }
    } else {
        UserNotInGroup
    }
}
