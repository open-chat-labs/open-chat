use crate::guards::caller_is_local_user_index;
use crate::updates::send_message::send_message_impl;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_handle_bot_action::*;
use group_canister::send_message_v2;
use types::HandleBotActionsError;
use types::{BotAction, MessageContentInitial, TextContent};
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

    match args.action {
        BotAction::SendTextMessage(send_message_args) => {
            send_message_impl(
                send_message_v2::Args {
                    thread_root_message_index: args.thread_root_message_index,
                    message_id: args.message_id,
                    content: MessageContentInitial::Text(TextContent {
                        text: send_message_args.text,
                    }),
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
                Some(args.bot.user_id.into()),
                state,
            );
        }
    }

    Ok(())
}

fn is_bot_permitted_to_execute_command(args: &Args, state: &RuntimeState) -> bool {
    // Get the permissions granted to the bot in this community
    let Some(granted_to_bot) = state.data.get_bot_permissions(&args.bot.user_id) else {
        return false;
    };

    // Get the permissions granted to the user in this community/channel
    let Some(granted_to_user) = state.data.get_user_permissions_for_bot_commands(&args.commanded_by) else {
        return false;
    };

    // Get the permissions required to execute the given action
    let permissions_required = args.action.permissions_required(args.thread_root_message_index.is_some());

    can_execute_bot_command(&permissions_required, granted_to_bot, &granted_to_user)
}
