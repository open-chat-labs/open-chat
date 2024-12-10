use crate::guards::caller_is_local_user_index;
use crate::updates::send_message::send_message_impl;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_handle_bot_action::*;
use community_canister::send_message;
use types::bot_actions::MessageContent;
use types::{BotAction, Chat, HandleBotActionsError, MessageContentInitial};
use utils::bots::can_execute_bot_command;

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

    if !is_bot_permitted_to_execute_command(&args, state) {
        return Err(HandleBotActionsError::NotAuthorized);
    }

    let Chat::Channel(_, channel_id) = args.chat else {
        unreachable!()
    };

    match args.action {
        BotAction::SendMessage(content) => {
            let content = match content {
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
                    thread_root_message_index: args.thread_root_message_index,
                    message_id: args.message_id,
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
                Some(args.bot.user_id.into()),
                state,
            ) {
                send_message::Response::Success(_) => Ok(()),
                response => Err(HandleBotActionsError::Other(format!("{response:?}"))),
            }
        }
    }
}

fn is_bot_permitted_to_execute_command(args: &Args, state: &RuntimeState) -> bool {
    let Chat::Channel(_, channel_id) = args.chat else {
        unreachable!()
    };

    // Get the permissions granted to the bot in this community
    let Some(granted_to_bot) = state.data.get_bot_permissions(&args.bot.user_id) else {
        return false;
    };

    // Get the permissions granted to the user in this community/channel
    let Some(granted_to_user) = state
        .data
        .get_user_permissions_for_bot_commands(&args.commanded_by, &channel_id)
    else {
        return false;
    };

    // Get the permissions required to execute the given action
    let permissions_required = args.action.permissions_required(args.thread_root_message_index.is_some());

    can_execute_bot_command(&permissions_required, granted_to_bot, &granted_to_user)
}
