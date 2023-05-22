use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::remove_reaction::{Response::*, *};
use group_chat_core::AddRemoveReactionResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn remove_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| remove_reaction_impl(args, state))
}

fn remove_reaction_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(user_id) = state.data.members.get(caller).map(|m| m.user_id) {
        let now = state.env.now();

        if let Some(group) = state.data.groups.get_mut(&args.group_id) {
            match group.remove_reaction(user_id, args.thread_root_message_index, args.message_id, args.reaction, now) {
                AddRemoveReactionResult::Success => Success,
                AddRemoveReactionResult::NoChange | AddRemoveReactionResult::InvalidReaction => NoChange,
                AddRemoveReactionResult::MessageNotFound => MessageNotFound,
                AddRemoveReactionResult::UserNotInGroup => UserNotInGroup,
                AddRemoveReactionResult::NotAuthorized => NotAuthorized,
                AddRemoveReactionResult::UserSuspended => UserSuspended,
            }
        } else {
            GroupNotFound
        }
    } else {
        CallerNotInCommunity
    }
}
