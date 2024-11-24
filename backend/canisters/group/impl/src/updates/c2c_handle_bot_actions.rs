use crate::guards::caller_is_bot_api_gateway;
use crate::updates::send_message::send_message_impl;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use bot_api_gateway_canister::c2c_handle_bot_actions;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_handle_bot_actions::*;
use group_canister::send_message_v2;
use types::{BotAction, MessageContentInitial, TextContent};

#[update(guard = "caller_is_bot_api_gateway", msgpack = true)]
#[trace]
async fn c2c_handle_bot_actions(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_handle_bot_actions_impl(args, state))
}

fn c2c_handle_bot_actions_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.frozen.is_some() {
        return Err(c2c_handle_bot_actions::HandleBotActionsError::Frozen);
    }

    for action in args.actions {
        match action {
            BotAction::SendTextMessage(send_message_args) => {
                send_message_impl(
                    send_message_v2::Args {
                        thread_root_message_index: send_message_args.thread_root_message_index,
                        message_id: send_message_args.message_id,
                        content: MessageContentInitial::Text(TextContent {
                            text: send_message_args.text,
                        }),
                        sender_name: args.bot_username.clone(),
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
                    Some(args.bot_user_id.into()),
                    state,
                );
            }
        }
    }

    Ok(())
}
