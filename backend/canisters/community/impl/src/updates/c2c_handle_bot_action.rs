use crate::guards::caller_is_bot_api_gateway;
use crate::updates::send_message::send_message_impl;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use bot_api_gateway_canister::c2c_handle_bot_action;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_handle_bot_action::*;
use community_canister::send_message;
use types::{BotAction, Chat, MessageContentInitial, TextContent};

#[update(guard = "caller_is_bot_api_gateway", msgpack = true)]
#[trace]
async fn c2c_handle_bot_action(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_handle_bot_action_impl(args, state))
}

fn c2c_handle_bot_action_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.frozen.is_some() {
        return Err(c2c_handle_bot_action::HandleBotActionsError::Frozen);
    }

    match args.action {
        BotAction::SendTextMessage(send_message_args) => {
            let Chat::Channel(_, channel_id) = args.chat else {
                unreachable!()
            };

            send_message_impl(
                send_message::Args {
                    channel_id,
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
                    community_rules_accepted: None,
                    channel_rules_accepted: None,
                    message_filter_failed: None,
                    new_achievement: false,
                },
                Some(args.bot.user_id.into()),
                state,
            );
        }
    }

    Ok(())
}
