use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_reaction::{Response::*, *};
use group_chat_core::AddRemoveReactionResult;

#[update(msgpack = true)]
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

    let Some(member) = state.data.members.get(caller) else {
        return UserNotInCommunity;
    };

    if member.suspended().value {
        return UserSuspended;
    } else if member.lapsed().value {
        return UserLapsed;
    }

    let user_id = member.user_id;
    let now = state.env.now();

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return ChannelNotFound;
    };

    match channel
        .chat
        .remove_reaction(user_id, args.thread_root_message_index, args.message_id, args.reaction, now)
    {
        AddRemoveReactionResult::Success(_) => {
            handle_activity_notification(state);
            Success
        }
        AddRemoveReactionResult::NoChange | AddRemoveReactionResult::InvalidReaction => NoChange,
        AddRemoveReactionResult::MessageNotFound => MessageNotFound,
        AddRemoveReactionResult::UserNotInGroup => UserNotInChannel,
        AddRemoveReactionResult::NotAuthorized => NotAuthorized,
        AddRemoveReactionResult::UserSuspended => UserSuspended,
        AddRemoveReactionResult::UserLapsed => UserLapsed,
    }
}
