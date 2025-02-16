use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, EditMessageResult};
use community_canister::edit_message::{Response::*, *};
use types::Achievement;

#[update(candid = true, msgpack = true)]
#[trace]
fn edit_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| edit_message_impl(args, state))
}

fn edit_message_impl(args: Args, state: &mut RuntimeState) -> Response {
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

    let now = state.env.now();

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return ChannelNotFound;
    };

    let sender = member.user_id;
    let Some(channel_member) = channel.chat.members.get(&sender) else {
        return UserNotInChannel;
    };

    if channel_member.lapsed().value {
        return UserLapsed;
    }

    match channel.chat.events.edit_message(
        EditMessageArgs {
            sender,
            min_visible_event_index: channel_member.min_visible_event_index(),
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            content: args.content,
            block_level_markdown: args.block_level_markdown,
            finalise_bot_message: false,
            now,
        },
        Some(&mut state.data.event_store_client),
    ) {
        EditMessageResult::Success(_, _) => {
            if args.new_achievement && !member.user_type.is_bot() {
                state.data.notify_user_of_achievement(sender, Achievement::EditedMessage);
            }

            handle_activity_notification(state);
            Success
        }
        EditMessageResult::NotAuthorized => MessageNotFound,
        EditMessageResult::NotFound => MessageNotFound,
    }
}
