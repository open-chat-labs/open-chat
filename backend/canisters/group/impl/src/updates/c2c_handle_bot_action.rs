use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::updates::send_message::send_message_impl;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_handle_bot_action::*;
use group_canister::send_message_v2;
use types::bot_actions::MessageContent;
use types::{BotAction, BotCaller, BotCommandCaller, MessageContentInitial};
use types::{BotPermissions, HandleBotActionsError};

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

    if !is_bot_permitted_to_execute_action(&args, state) {
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

            let bot_caller = match args.command {
                Some(command) => BotCaller::Command(BotCommandCaller {
                    bot: args.bot.user_id,
                    command,
                    finalised: action.finalised,
                }),
                None => BotCaller::ApiKey(args.bot.user_id),
            };

            match send_message_impl(
                send_message_v2::Args {
                    thread_root_message_index: args.chat_details.thread_root_message_index,
                    message_id: args.chat_details.message_id,
                    content,
                    sender_name: args.bot.username.clone(),
                    sender_display_name: None,
                    replies_to: None,
                    mentioned: Vec::new(),
                    forwarding: false,
                    block_level_markdown: false,
                    rules_accepted: None,
                    message_filter_failed: None,
                    new_achievement: false,
                    correlation_id: 0,
                },
                Some(bot_caller),
                state,
            ) {
                send_message_v2::Response::Success(_) => Ok(()),
                response => Err(HandleBotActionsError::Other(format!("{response:?}"))),
            }
        }
    };

    if response.is_ok() {
        handle_activity_notification(state);
    }

    response
}

fn is_bot_permitted_to_execute_action(args: &Args, state: &RuntimeState) -> bool {
    // Get the permissions granted to the bot in this group
    let Some(granted_to_bot) = state.data.get_bot_permissions(&args.bot.user_id) else {
        return false;
    };

    // Get the permissions granted to the user in this group iff there is an initiator
    let granted = if let Some(initiator) = args.command.as_ref().map(|c| &c.initiator) {
        if let Some(granted_to_user) = state.data.get_user_permissions_for_bot_commands(initiator) {
            &BotPermissions::intersect(granted_to_bot, &granted_to_user)
        } else {
            return false;
        }
    } else {
        granted_to_bot
    };

    // The permissions required for the action must be a subset of the permissions granted to the bot
    args.action.permissions_required().is_subset(granted)
}
