use crate::guards::caller_is_group_index_or_local_group_index;
use crate::{mutate_state, run_regular_jobs, CommunityBeingImportedInto, RuntimeState, StartImportIntoCommunityResult};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_start_import_into_community::{Response::*, *};

#[update_msgpack(guard = "caller_is_group_index_or_local_group_index")]
#[trace]
fn c2c_start_import_into_community(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_start_import_into_community_impl(args, state))
}

fn c2c_start_import_into_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    if args.user_id != state.data.proposals_bot_user_id {
        if let Some(member) = state.data.chat.members.get(&args.user_id) {
            if member.suspended.value {
                return UserSuspended;
            } else if !member.role.is_owner() {
                return NotAuthorized;
            }
        } else {
            return UserNotInGroup;
        }
    }

    match state.start_importing_into_community(CommunityBeingImportedInto::Existing(args.community_id)) {
        StartImportIntoCommunityResult::Success(total_bytes) => Success(total_bytes),
        StartImportIntoCommunityResult::AlreadyImportingToAnotherCommunity => AlreadyImportingToAnotherCommunity,
        StartImportIntoCommunityResult::ChatFrozen => ChatFrozen,
    }
}
