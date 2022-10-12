use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::openchat_bot::OPENCHAT_BOT_USER_ID;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::PushMessageArgs;
use ic_cdk_macros::update;
use tracing::error;
use types::{
    CanisterId, CompletedCryptoTransaction, ContentValidationError, CryptoTransaction, MessageContent, MessageId, MessageIndex,
    UserId,
};
use user_canister::c2c_send_message::{self, C2CReplyContext};
use user_canister::send_message::{Response::*, *};

// The args are mutable because if the request contains a pending transfer, we process the transfer
// and then update the message content to contain the completed transfer.
#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message(mut args: Args) -> Response {
    run_regular_jobs();

    let is_bot = match read_state(|state| validate_request(&args, state)) {
        ValidateRequestResult::Valid(b) => b,
        ValidateRequestResult::Invalid(response) => return response,
        ValidateRequestResult::RecipientUnknown(user_index_canister_id) => {
            let c2c_args = user_index_canister::c2c_lookup_principal::Args { user_id: args.recipient };
            match user_index_canister_c2c_client::c2c_lookup_principal(user_index_canister_id, &c2c_args).await {
                Ok(user_index_canister::c2c_lookup_principal::Response::Success(result)) => result.is_bot,
                Ok(user_index_canister::c2c_lookup_principal::Response::UserNotFound) => return RecipientNotFound,
                Err(error) => return InternalError(format!("{:?}", error)),
            }
        }
    };

    let mut completed_transfer = None;
    // If the message includes a pending cryptocurrency transfer, we process that and then update
    // the message to contain the completed transfer.
    if let MessageContent::Crypto(c) = &mut args.content {
        let pending_transaction = match &c.transfer {
            CryptoTransaction::Pending(t) => t.clone(),
            _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
        };
        if !pending_transaction.is_user_recipient(args.recipient) {
            return InvalidRequest("Transaction is not to the user's account".to_string());
        }

        completed_transfer = match process_transaction(pending_transaction).await {
            Ok(completed) => {
                c.transfer = CryptoTransaction::Completed(completed.clone());
                Some(completed)
            }
            Err(failed) => return TransferFailed(failed.error_message().to_string()),
        };
    }

    mutate_state(|state| send_message_impl(args, completed_transfer, is_bot, state))
}

#[allow(clippy::large_enum_variant)]
enum ValidateRequestResult {
    Valid(bool), // Value is `is_bot`
    Invalid(Response),
    RecipientUnknown(CanisterId), // Value is the user_index canisterId
}

fn validate_request(args: &Args, runtime_state: &RuntimeState) -> ValidateRequestResult {
    if runtime_state.data.blocked_users.contains(&args.recipient) {
        return ValidateRequestResult::Invalid(RecipientBlocked);
    }
    if args.recipient == OPENCHAT_BOT_USER_ID {
        return ValidateRequestResult::Invalid(InvalidRequest(
            "Messaging the OpenChat Bot is not currently supported".to_string(),
        ));
    }

    let now = runtime_state.env.now();

    if let Err(error) = args.content.validate_for_new_message(true, args.forwarding, now) {
        ValidateRequestResult::Invalid(match error {
            ContentValidationError::Empty => MessageEmpty,
            ContentValidationError::TextTooLong(max_length) => TextTooLong(max_length),
            ContentValidationError::InvalidPoll(reason) => InvalidPoll(reason),
            ContentValidationError::TransferCannotBeZero => TransferCannotBeZero,
            ContentValidationError::TransferLimitExceeded(limit) => TransferLimitExceeded(limit),
            ContentValidationError::InvalidTypeForForwarding => {
                InvalidRequest("Cannot forward this type of message".to_string())
            }
        })
    } else if let Some(chat) = runtime_state.data.direct_chats.get(&args.recipient.into()) {
        ValidateRequestResult::Valid(chat.is_bot)
    } else {
        ValidateRequestResult::RecipientUnknown(runtime_state.data.user_index_canister_id)
    }
}

fn send_message_impl(
    args: Args,
    completed_transfer: Option<CompletedCryptoTransaction>,
    is_bot: bool,
    runtime_state: &mut RuntimeState,
) -> Response {
    let now = runtime_state.env.now();
    let my_user_id = runtime_state.env.canister_id().into();
    let recipient = args.recipient;

    let push_message_args = PushMessageArgs {
        thread_root_message_index: None,
        message_id: args.message_id,
        sender: my_user_id,
        content: args.content.clone().new_content_into_internal(),
        replies_to: args.replies_to.clone(),
        forwarded: args.forwarding,
        correlation_id: args.correlation_id,
        now,
    };

    let message_event = runtime_state
        .data
        .direct_chats
        .push_message(true, recipient, None, push_message_args, is_bot);

    let c2c_args = c2c_send_message::Args {
        message_id: args.message_id,
        sender_name: args.sender_name,
        sender_message_index: message_event.event.message_index,
        content: args.content,
        replies_to: args.replies_to.and_then(|r| {
            if let Some(chat_id) = r.chat_id_if_other {
                Some(C2CReplyContext::OtherChat(chat_id, r.event_index))
            } else {
                runtime_state
                    .data
                    .direct_chats
                    .get(&args.recipient.into())
                    .and_then(|chat| {
                        chat.events
                            .main()
                            .message_internal_by_event_index(r.event_index)
                            .map(|m| m.message_id)
                    })
                    .map(C2CReplyContext::ThisChat)
            }
        }),
        forwarding: args.forwarding,
        correlation_id: args.correlation_id,
    };

    if is_bot {
        ic_cdk::spawn(send_to_bot_canister(recipient, message_event.event.message_index, c2c_args));
    } else {
        ic_cdk::spawn(send_to_recipients_canister(recipient, c2c_args, false));
    }

    if let Some(transfer) = completed_transfer {
        TransferSuccessV2(TransferSuccessV2Result {
            chat_id: recipient.into(),
            event_index: message_event.index,
            message_index: message_event.event.message_index,
            timestamp: now,
            transfer,
        })
    } else {
        Success(SuccessResult {
            chat_id: recipient.into(),
            event_index: message_event.index,
            message_index: message_event.event.message_index,
            timestamp: now,
        })
    }
}

pub(crate) async fn send_to_recipients_canister(recipient: UserId, args: c2c_send_message::Args, is_retry: bool) {
    // Note: We ignore any Blocked responses - it means the sender won't know they're blocked
    // but maybe that is not so bad. Otherwise we would have to wait for the call to the
    // recipient canister which would double the latency of every message.
    if let Err(error) = user_canister_c2c_client::c2c_send_message(recipient.into(), &args).await {
        if is_retry {
            // If this is already a retry, don't try sending again
            error!(?error, ?recipient, "Failed to send message to recipient even after retrying");
        } else {
            // If this is not a retry, queue up the message to be retried
            let user_index_canister_id = mutate_state(|state| queue_failed_message_for_retry(recipient, args, state));

            let _ = user_index_canister_c2c_client::c2c_mark_send_message_failed(
                user_index_canister_id,
                &user_index_canister::c2c_mark_send_message_failed::Args { recipient },
            )
            .await;
        }
    }
}

async fn send_to_bot_canister(recipient: UserId, message_index: MessageIndex, args: bot_api::handle_direct_message::Args) {
    match bot_c2c_client::handle_direct_message(recipient.into(), &args).await {
        Ok(bot_api::handle_direct_message::Response::Success(result)) => {
            mutate_state(|state| {
                let now = state.env.now();
                for message in result.messages {
                    let push_message_args = PushMessageArgs {
                        sender: recipient,
                        thread_root_message_index: None,
                        message_id: MessageId::generate(|| state.env.random_u32()),
                        content: message.content,
                        replies_to: None,
                        forwarded: false,
                        correlation_id: 0,
                        now,
                    };
                    state
                        .data
                        .direct_chats
                        .push_message(false, recipient, None, push_message_args, true);
                }

                // Mark that the bot has read the message we just sent
                if let Some(chat) = state.data.direct_chats.get_mut(&recipient.into()) {
                    chat.mark_read_up_to(message_index, false, now);
                }
            });
        }
        Err(_error) => {
            // TODO push message saying that the message failed to send
        }
    }
}

// Returns the user_index_canister_id
fn queue_failed_message_for_retry(
    recipient: UserId,
    args: c2c_send_message::Args,
    runtime_state: &mut RuntimeState,
) -> CanisterId {
    runtime_state.data.failed_messages_pending_retry.add(recipient, args);

    runtime_state.data.user_index_canister_id
}
