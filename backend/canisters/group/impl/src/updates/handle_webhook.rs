use crate::{RuntimeState, execute_update};
use group_canister::handle_webhook::*;
use group_canister::send_message_v2::SuccessResult;
use oc_error_codes::OCErrorCode;
use rand::Rng;
use types::{Caller, MessageContentInitial, OCResult, TextContent};

use super::send_message::send_message_impl;

pub(crate) fn handle_webhook(args: Args) -> Response {
    match execute_update(|state| handle_webhook_impl(args, state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

fn handle_webhook_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    let Some(webhook) = state.data.chat.webhooks.get(&args.id) else {
        return Err(OCErrorCode::WebhookNotFound.into());
    };

    if webhook.secret != args.secret {
        return Err(OCErrorCode::InvalidWebhook.into());
    }

    let send_message_args = group_canister::send_message_v2::Args {
        thread_root_message_index: None,
        message_id: state.env.rng().r#gen::<u64>().into(),
        content: MessageContentInitial::Text(TextContent { text: args.message }),
        sender_name: webhook.name.clone(),
        sender_display_name: None,
        replies_to: None,
        mentioned: vec![],
        forwarding: false,
        block_level_markdown: true,
        rules_accepted: None,
        message_filter_failed: None,
        new_achievement: false,
    };

    send_message_impl(send_message_args, Some(Caller::Webhook(args.id)), true, state)
}
