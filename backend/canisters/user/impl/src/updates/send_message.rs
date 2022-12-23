use crate::crypto::process_transaction_without_caller_check;
use crate::guards::caller_is_owner;
use crate::timer_job_types::RetrySendingFailedMessageJob;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState, TimerJob};
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
use utils::consts::OPENCHAT_BOT_USER_ID;
use utils::time::{MINUTE_IN_MS, SECOND_IN_MS};

// The args are mutable because if the request contains a pending transfer, we process the transfer
// and then update the message content to contain the completed transfer.
#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message(mut args: Args) -> Response {
    run_regular_jobs();

    let user_type = match read_state(|state| validate_request(&args, state)) {
        ValidateRequestResult::Valid(t) => t,
        ValidateRequestResult::Invalid(response) => return response,
        ValidateRequestResult::RecipientUnknown(local_user_index_canister_id) => {
            let c2c_args = local_user_index_canister::c2c_lookup_user::Args {
                user_id_or_principal: args.recipient.into(),
            };
            match local_user_index_canister_c2c_client::c2c_lookup_user(local_user_index_canister_id, &c2c_args).await {
                Ok(local_user_index_canister::c2c_lookup_user::Response::Success(result)) if result.is_bot => UserType::Bot,
                Ok(local_user_index_canister::c2c_lookup_user::Response::Success(_)) => UserType::User,
                Ok(local_user_index_canister::c2c_lookup_user::Response::UserNotFound) => return RecipientNotFound,
                Err(error) => return InternalError(format!("{:?}", error)),
            }
        }
    };

    let mut completed_transfer = None;
    // If the message includes a pending cryptocurrency transfer, we process that and then update
    // the message to contain the completed transfer.
    if let MessageContent::Crypto(c) = &mut args.content {
        if user_type.is_self() {
            return InvalidRequest("Cannot send crypto to yourself".to_string());
        }
        let pending_transaction = match &c.transfer {
            CryptoTransaction::Pending(t) => t.clone(),
            _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
        };
        if !pending_transaction.is_user_recipient(args.recipient) {
            return InvalidRequest("Transaction is not to the user's account".to_string());
        }

        // We have to use `process_transaction_without_caller_check` because we may be within a
        // reply callback due to calling `c2c_lookup_user` earlier.
        completed_transfer = match process_transaction_without_caller_check(pending_transaction).await {
            Ok(completed) => {
                c.transfer = CryptoTransaction::Completed(completed.clone());
                Some(completed)
            }
            Err(failed) => return TransferFailed(failed.error_message().to_string()),
        };
    }

    mutate_state(|state| send_message_impl(args, completed_transfer, user_type, state))
}

enum UserType {
    _Self,
    User,
    Bot,
}

impl UserType {
    fn is_self(&self) -> bool {
        matches!(self, UserType::_Self)
    }

    fn is_bot(&self) -> bool {
        matches!(self, UserType::Bot)
    }
}

#[allow(clippy::large_enum_variant)]
enum ValidateRequestResult {
    Valid(UserType),
    Invalid(Response),
    RecipientUnknown(CanisterId), // Value is the user_index canisterId
}

fn validate_request(args: &Args, runtime_state: &RuntimeState) -> ValidateRequestResult {
    if runtime_state.data.suspended.value {
        return ValidateRequestResult::Invalid(UserSuspended);
    }
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
    } else if args.recipient == runtime_state.env.canister_id().into() {
        ValidateRequestResult::Valid(UserType::_Self)
    } else if let Some(chat) = runtime_state.data.direct_chats.get(&args.recipient.into()) {
        let user_type = if chat.is_bot { UserType::Bot } else { UserType::User };
        ValidateRequestResult::Valid(user_type)
    } else {
        ValidateRequestResult::RecipientUnknown(runtime_state.data.local_user_index_canister_id)
    }
}

fn send_message_impl(
    args: Args,
    completed_transfer: Option<CompletedCryptoTransaction>,
    user_type: UserType,
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

    let message_event =
        runtime_state
            .data
            .direct_chats
            .push_message(true, recipient, None, push_message_args, user_type.is_bot());

    if !user_type.is_self() {
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

        if user_type.is_bot() {
            ic_cdk::spawn(send_to_bot_canister(recipient, message_event.event.message_index, c2c_args));
        } else {
            ic_cdk::spawn(send_to_recipients_canister(recipient, c2c_args, 0));
        }
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

pub(crate) async fn send_to_recipients_canister(recipient: UserId, args: c2c_send_message::Args, attempt: u32) {
    // Note: We ignore any Blocked responses - it means the sender won't know they're blocked
    // but maybe that is not so bad. Otherwise we would have to wait for the call to the
    // recipient canister which would double the latency of every message.
    if let Err(error) = user_canister_c2c_client::c2c_send_message(recipient.into(), &args).await {
        let retry_interval = match attempt {
            0 => Some(10 * SECOND_IN_MS),
            1 => Some(20 * SECOND_IN_MS),
            2 => Some(30 * SECOND_IN_MS),
            3 => Some(MINUTE_IN_MS),
            4 => Some(2 * MINUTE_IN_MS),
            _ => None,
        };
        if let Some(interval) = retry_interval {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.timer_jobs.enqueue_job(
                    TimerJob::RetrySendingFailedMessage(Box::new(RetrySendingFailedMessageJob {
                        recipient,
                        args,
                        attempt: attempt + 1,
                    })),
                    now + interval,
                    now,
                );
            });
        } else {
            error!(?error, ?recipient, "Failed to send message to recipient even after retrying");
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
                        content: message.content.new_content_into_internal(),
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
