use crate::{activity_notifications::handle_activity_notification, mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::remove_reaction::{Response::*, *};
use group_chat_core::AddRemoveReactionResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn remove_reaction(args: Args) -> Response {
    mutate_state(|state| remove_reaction_impl(args, state))
}

fn remove_reaction_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let user_id = member.user_id;
        let now = state.env.now();

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            match channel
                .chat
                .remove_reaction(user_id, args.thread_root_message_index, args.message_id, args.reaction, now)
            {
                AddRemoveReactionResult::Success => {
                    handle_activity_notification(state);
                    Success
                }
                AddRemoveReactionResult::NoChange | AddRemoveReactionResult::InvalidReaction => NoChange,
                AddRemoveReactionResult::MessageNotFound => MessageNotFound,
                AddRemoveReactionResult::UserNotInGroup => UserNotInChannel,
                AddRemoveReactionResult::NotAuthorized => NotAuthorized,
                AddRemoveReactionResult::UserSuspended => UserSuspended,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
