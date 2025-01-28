use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::updates::send_message::send_message_impl;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_handle_bot_action::*;
use community_canister::send_message;
use types::bot_actions::MessageContent;
use types::{BotAction, BotCaller, ChannelId, Chat, HandleBotActionsError, MessageContentInitial, UserId};
use utils::bots::{can_bot_execute_action, intersect_permissions};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_handle_bot_action(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_handle_bot_action_impl(args, state))
}

fn c2c_handle_bot_action_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.frozen.is_some() {
        return Err(HandleBotActionsError::Frozen);
    }

    let Chat::Channel(_, channel_id) = args.chat_details.chat else {
        return Err(HandleBotActionsError::Other("A chat must be a channel".to_string()));
    };

    if !is_bot_permitted_to_execute_action(
        channel_id,
        &args.bot.user_id,
        args.command.as_ref().map(|c| &c.initiator),
        &args.action,
        state,
    ) {
        return Err(HandleBotActionsError::NotAuthorized);
    }

    let response = match args.action {
        BotAction::SendMessage(action) => {
            let content = match action.content {
                MessageContent::Text(text_content) => MessageContentInitial::Text(text_content),
                MessageContent::Image(image_content) => MessageContentInitial::Image(image_content),
                MessageContent::Video(video_content) => MessageContentInitial::Video(video_content),
                MessageContent::Audio(audio_content) => MessageContentInitial::Audio(audio_content),
                MessageContent::File(file_content) => MessageContentInitial::File(file_content),
                MessageContent::Poll(poll_content) => MessageContentInitial::Poll(poll_content),
                MessageContent::Giphy(giphy_content) => MessageContentInitial::Giphy(giphy_content),
            };

            match send_message_impl(
                send_message::Args {
                    channel_id,
                    thread_root_message_index: args.chat_details.thread_root_message_index,
                    message_id: args.chat_details.message_id,
                    content,
                    sender_name: args.bot.username.clone(),
                    sender_display_name: None,
                    replies_to: None,
                    mentioned: Vec::new(),
                    forwarding: false,
                    block_level_markdown: false,
                    community_rules_accepted: None,
                    channel_rules_accepted: None,
                    message_filter_failed: None,
                    new_achievement: false,
                },
                args.command.map(|command| BotCaller {
                    bot: args.bot.user_id,
                    command,
                    finalised: action.finalised,
                }),
                state,
            ) {
                send_message::Response::Success(_) => Ok(()),
                response => Err(HandleBotActionsError::Other(format!("{response:?}"))),
            }
        }
    };

    if response.is_ok() {
        handle_activity_notification(state);
    }

    response
}

fn is_bot_permitted_to_execute_action(
    channel_id: ChannelId,
    bot_id: &UserId,
    initiator: Option<&UserId>,
    action: &BotAction,
    state: &RuntimeState,
) -> bool {
    // Get the permissions granted to the bot in this community
    let Some(granted_to_bot) = state.data.get_bot_permissions(bot_id) else {
        return false;
    };

    // Get the permissions granted to the user in this community/channel iff there is an initiator
    let granted = if let Some(initiator) = initiator {
        if let Some(granted_to_user) = state.data.get_user_permissions_for_bot_commands(initiator, Some(channel_id)) {
            &intersect_permissions(granted_to_bot, &granted_to_user)
        } else {
            return false;
        }
    } else {
        granted_to_bot
    };

    // Get the permissions required to execute the given action
    let permissions_required = action.permissions_required();

    can_bot_execute_action(&permissions_required, granted)
}
