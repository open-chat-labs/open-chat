use crate::crypto::process_transaction_without_caller_check;
use crate::guards::caller_is_local_user_index;
use crate::guards::caller_is_owner;
use crate::model::pin_number::VerifyPinError;
use crate::timer_job_types::{DeleteFileReferencesJob, MarkP2PSwapExpiredJob, NotifyEscrowCanisterOfDepositJob};
use crate::updates::send_message_with_transfer::set_up_p2p_swap;
use crate::{mutate_state, read_state, run_regular_jobs, Data, RuntimeState, TimerJob};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::EditMessageArgs;
use chat_events::EditMessageResult;
use chat_events::{MessageContentInternal, PushMessageArgs, Reader, ReplyContextInternal, ValidateNewMessageContentResult};
use constants::{MEMO_MESSAGE, OPENCHAT_BOT_USER_ID};
use event_store_producer_cdk_runtime::CdkRuntime;
use rand::Rng;
use types::BotCaller;
use types::BotPermissions;
use types::DirectMessageNotification;
use types::EventIndex;
use types::Notification;
use types::{
    BlobReference, CanisterId, Chat, ChatId, CompletedCryptoTransaction, ContentValidationError, CryptoTransaction,
    EventWrapper, Message, MessageContent, MessageContentInitial, MessageId, MessageIndex, P2PSwapLocation, ReplyContext,
    TimestampMillis, UserId, UserType,
};
use user_canister::c2c_bot_send_message;
use user_canister::send_message_v2::{Response::*, *};
use user_canister::{C2CReplyContext, SendMessageArgs, SendMessagesArgs, UserCanisterEvent};

use super::c2c_send_messages::handle_message_impl;
use super::c2c_send_messages::HandleMessageArgs;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn send_message_v2(args: Args) -> Response {
    run_regular_jobs();

    let PrepareOk {
        my_user_id,
        now,
        local_user_index_canister_id,
        maybe_recipient_type,
    } = match read_state(|state| prepare(&args, false, state)) {
        Ok(ok) => ok,
        Err(response) => return *response,
    };

    let recipient_type = if let Some(recipient_type) = maybe_recipient_type {
        recipient_type
    } else {
        let c2c_args = local_user_index_canister::c2c_lookup_user::Args {
            user_id_or_principal: args.recipient.into(),
        };
        match local_user_index_canister_c2c_client::c2c_lookup_user(local_user_index_canister_id, &c2c_args).await {
            Ok(local_user_index_canister::c2c_lookup_user::Response::Success(result)) => RecipientType::Other(result.user_type),
            Ok(local_user_index_canister::c2c_lookup_user::Response::UserNotFound) => return RecipientNotFound,
            Err(error) => return InternalError(format!("{error:?}")),
        }
    };

    let (content, completed_transfer) =
        match MessageContentInternal::validate_new_message(args.content, true, UserType::User, args.forwarding, now) {
            ValidateNewMessageContentResult::Success(content) => (content, None),
            ValidateNewMessageContentResult::SuccessCrypto(content) => {
                let mut pending_transfer = match &content.transfer {
                    CryptoTransaction::Pending(t) => t.clone().set_memo(&MEMO_MESSAGE),
                    _ => unreachable!(),
                };

                if !pending_transfer.validate_recipient(args.recipient) {
                    return InvalidRequest("Transaction is not to the user's account".to_string());
                }

                if let Err(error) = mutate_state(|state| state.data.pin_number.verify(args.pin.as_deref(), now)) {
                    return match error {
                        VerifyPinError::PinRequired => PinRequired,
                        VerifyPinError::PinIncorrect(delay) => PinIncorrect(delay),
                        VerifyPinError::TooManyFailedAttempted(delay) => TooManyFailedPinAttempts(delay),
                    };
                }

                // When transferring to bot users, each user transfers to their own subaccount, this way it
                // is trivial for the bots to keep track of each user's funds
                if recipient_type.user_type().is_bot() {
                    pending_transfer.set_recipient(args.recipient.into(), Principal::from(my_user_id).into());
                }

                // We have to use `process_transaction_without_caller_check` because we may be within a
                // reply callback due to calling `c2c_lookup_user` earlier.
                match process_transaction_without_caller_check(pending_transfer).await {
                    Ok(Ok(completed)) => read_state(|state| {
                        let content = MessageContentInternal::new_with_transfer(
                            MessageContentInitial::Crypto(content),
                            completed.clone().into(),
                            None,
                            state.env.now(),
                        );
                        (content, Some(completed))
                    }),
                    Ok(Err(failed)) => return TransferFailed(failed.error_message().to_string()),
                    Err(error) => return InternalError(format!("{error:?}")),
                }
            }
            ValidateNewMessageContentResult::SuccessPrize(_) => unreachable!(),
            ValidateNewMessageContentResult::SuccessP2PSwap(content) => {
                let (escrow_canister_id, now) = read_state(|state| (state.data.escrow_canister_id, state.env.now()));
                let create_swap_args = escrow_canister::create_swap::Args {
                    location: P2PSwapLocation::from_message(Chat::Direct(args.recipient.into()), None, args.message_id),
                    token0: content.token0.clone(),
                    token0_amount: content.token0_amount,
                    token1: content.token1.clone(),
                    token1_amount: content.token1_amount,
                    expires_at: now + content.expires_in,
                    additional_admins: Vec::new(),
                    canister_to_notify: Some(args.recipient.into()),
                };
                match set_up_p2p_swap(escrow_canister_id, create_swap_args).await {
                    Ok((swap_id, pending_transaction)) => {
                        match process_transaction_without_caller_check(pending_transaction).await {
                            Ok(Ok(completed)) => {
                                NotifyEscrowCanisterOfDepositJob::run(swap_id);
                                let content = MessageContentInternal::new_with_transfer(
                                    MessageContentInitial::P2PSwap(content),
                                    completed.clone().into(),
                                    Some(swap_id),
                                    read_state(|state| state.env.now()),
                                );
                                (content, Some(completed))
                            }
                            Ok(Err(failed)) => {
                                return TransferFailed(failed.error_message().to_string());
                            }
                            Err(error) => return InternalError(format!("{error:?}")),
                        }
                    }
                    Err(error) => return error.into(),
                }
            }
            ValidateNewMessageContentResult::Error(error) => {
                return match error {
                    ContentValidationError::Empty => MessageEmpty,
                    ContentValidationError::TextTooLong(max_length) => TextTooLong(max_length),
                    ContentValidationError::InvalidPoll(reason) => InvalidPoll(reason),
                    ContentValidationError::TransferCannotBeZero => TransferCannotBeZero,
                    ContentValidationError::InvalidTypeForForwarding => {
                        InvalidRequest("Cannot forward this type of message".to_string())
                    }
                    ContentValidationError::TransferMustBePending | ContentValidationError::PrizeEndDateInThePast => {
                        unreachable!()
                    }
                    ContentValidationError::Unauthorized => {
                        InvalidRequest("User unauthorized to send messages of this type".to_string())
                    }
                }
            }
        };

    mutate_state(|state| {
        send_message_impl(
            my_user_id,
            args.recipient,
            args.thread_root_message_index,
            args.message_id,
            content,
            args.replies_to,
            args.forwarding,
            args.block_level_markdown,
            args.message_filter_failed,
            recipient_type,
            completed_transfer,
            state,
        )
    })
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_send_message(args: c2c_bot_send_message::Args) -> c2c_bot_send_message::Response {
    run_regular_jobs();

    mutate_state(|state| {
        let finalised = args.finalised;
        let bot_id = args.bot_id;
        let bot_name = args.bot_name.clone();
        let bot_caller = BotCaller {
            bot: args.bot_id,
            initiator: args.initiator.clone(),
        };

        let args: Args = args.into();
        let message_content: MessageContent = args.content.clone().into();

        if !state.data.is_bot_permitted(
            &bot_id,
            &bot_caller.initiator,
            BotPermissions::from_message_permission((&args.content).into()),
        ) {
            return c2c_bot_send_message::Response::NotAuthorized;
        }

        let now = state.env.now();

        let content =
            match MessageContentInternal::validate_new_message(args.content, true, UserType::BotV2, args.forwarding, now) {
                ValidateNewMessageContentResult::Success(content) => content,
                ValidateNewMessageContentResult::SuccessP2PSwap(_)
                | ValidateNewMessageContentResult::SuccessCrypto(_)
                | ValidateNewMessageContentResult::SuccessPrize(_) => unreachable!(),
                ValidateNewMessageContentResult::Error(error) => {
                    let response = match error {
                        ContentValidationError::Empty => MessageEmpty,
                        ContentValidationError::TextTooLong(max_length) => TextTooLong(max_length),
                        ContentValidationError::InvalidPoll(reason) => InvalidPoll(reason),
                        ContentValidationError::TransferCannotBeZero => TransferCannotBeZero,
                        ContentValidationError::InvalidTypeForForwarding => {
                            InvalidRequest("Cannot forward this type of message".to_string())
                        }
                        ContentValidationError::TransferMustBePending | ContentValidationError::PrizeEndDateInThePast => {
                            unreachable!()
                        }
                        ContentValidationError::Unauthorized => {
                            InvalidRequest("User unauthorized to send messages of this type".to_string())
                        }
                    };

                    return response.into();
                }
            };

        // Check if a message with the same id already exists
        if let Some(chat) = state.data.direct_chats.get_mut(&bot_id.into()) {
            if let Some((message, _)) =
                chat.events
                    .message_internal(EventIndex::default(), args.thread_root_message_index, args.message_id.into())
            {
                // If the message id of a bot message matches an existing unfinalised bot message
                // then edit this message instead of pushing a new one
                if let Some(bot_message) = message.bot_context {
                    if bot_caller.bot == message.sender
                        && bot_caller.initiator.user() == bot_message.command.as_ref().map(|c| c.initiator)
                        && bot_caller.initiator.command() == bot_message.command.as_ref()
                        && !bot_message.finalised
                    {
                        let edit_message_args = EditMessageArgs {
                            sender: bot_caller.bot,
                            min_visible_event_index: EventIndex::default(),
                            thread_root_message_index: args.thread_root_message_index,
                            message_id: args.message_id,
                            content,
                            block_level_markdown: Some(args.block_level_markdown),
                            finalise_bot_message: finalised,
                            now,
                        };

                        let EditMessageResult::Success(message_index, event) =
                            chat.events.edit_message::<CdkRuntime>(edit_message_args, None)
                        else {
                            // Shouldn't happen
                            return c2c_bot_send_message::Response::NotAuthorized;
                        };

                        if finalised && !chat.notifications_muted.value {
                            let notification = Notification::DirectMessage(DirectMessageNotification {
                                sender: bot_id,
                                thread_root_message_index: args.thread_root_message_index,
                                message_index,
                                event_index: event.index,
                                sender_name: bot_name,
                                sender_display_name: None,
                                message_type: message_content.message_type(),
                                message_text: message_content.notification_text(&[], &[]),
                                image_url: message_content.notification_image_url(),
                                sender_avatar_id: None,
                                crypto_transfer: message_content.notification_crypto_transfer_details(&[]),
                            });
                            let recipient = state.env.canister_id().into();

                            state.push_notification(Some(bot_id), recipient, notification);
                        }

                        return c2c_bot_send_message::Response::Success(SuccessResult {
                            chat_id: bot_id.into(),
                            event_index: event.index,
                            message_index,
                            expires_at: event.expires_at,
                            timestamp: now,
                        });
                    }
                }

                return c2c_bot_send_message::Response::MessageAlreadyFinalised;
            }
        }

        let event_wrapper = handle_message_impl(
            HandleMessageArgs {
                sender: bot_id,
                thread_root_message_id: None,
                message_id: Some(args.message_id),
                sender_message_index: None,
                sender_name: bot_name,
                sender_display_name: None,
                content,
                replies_to: None,
                forwarding: false,
                sender_user_type: UserType::BotV2,
                sender_avatar_id: None,
                push_message_sent_event: true,
                mentioned: Vec::new(),
                mute_notification: !finalised,
                block_level_markdown: args.block_level_markdown,
                now,
            },
            Some(bot_caller),
            finalised,
            state,
        );

        c2c_bot_send_message::Response::Success(SuccessResult {
            chat_id: bot_id.into(),
            event_index: event_wrapper.index,
            message_index: event_wrapper.event.message_index,
            expires_at: event_wrapper.expires_at,
            timestamp: now,
        })
    })
}

#[derive(Copy, Clone)]
enum RecipientType {
    _Self,
    Other(UserType),
}

impl RecipientType {
    fn is_self(&self) -> bool {
        matches!(self, RecipientType::_Self)
    }

    fn user_type(self) -> UserType {
        self.into()
    }
}

impl From<RecipientType> for UserType {
    fn from(value: RecipientType) -> Self {
        match value {
            RecipientType::_Self => UserType::User,
            RecipientType::Other(u) => u,
        }
    }
}

struct PrepareOk {
    my_user_id: UserId,
    now: TimestampMillis,
    local_user_index_canister_id: CanisterId,
    maybe_recipient_type: Option<RecipientType>,
}

fn prepare(args: &Args, is_v2_bot: bool, state: &RuntimeState) -> Result<PrepareOk, Box<Response>> {
    if state.data.suspended.value {
        return Err(Box::new(UserSuspended));
    }

    if state.data.blocked_users.contains(&args.recipient) {
        return Err(Box::new(RecipientBlocked));
    }

    if args.recipient == OPENCHAT_BOT_USER_ID {
        return Err(Box::new(InvalidRequest(
            "Messaging the OpenChat Bot is not currently supported".to_string(),
        )));
    }

    let my_user_id = state.env.canister_id().into();
    let maybe_recipient_type = if let Some(chat) = state.data.direct_chats.get(&args.recipient.into()) {
        if chat
            .events
            .message_already_finalised(args.thread_root_message_index, args.message_id, is_v2_bot)
        {
            return Err(Box::new(DuplicateMessageId));
        }
        Some(if args.recipient == my_user_id {
            RecipientType::_Self
        } else {
            RecipientType::Other(chat.user_type)
        })
    } else {
        None
    };

    Ok(PrepareOk {
        my_user_id,
        now: state.env.now(),
        local_user_index_canister_id: state.data.local_user_index_canister_id,
        maybe_recipient_type,
    })
}

#[allow(clippy::too_many_arguments)]
fn send_message_impl(
    my_user_id: UserId,
    recipient: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    content: MessageContentInternal,
    replies_to: Option<ReplyContext>,
    forwarding: bool,
    block_level_markdown: bool,
    message_filter_failed: Option<u64>,
    recipient_type: RecipientType,
    completed_transfer: Option<CompletedCryptoTransaction>,
    state: &mut RuntimeState,
) -> Response {
    let now = state.env.now();
    let reply_context = replies_to.as_ref().map(ReplyContextInternal::from);

    let chat_private_replying_to = if let Some((chat, None)) = reply_context.as_ref().and_then(|r| r.chat_if_other) {
        Some(chat)
    } else {
        None
    };

    let push_message_args = PushMessageArgs {
        thread_root_message_index,
        message_id,
        sender: my_user_id,
        content: content.clone(),
        mentioned: Vec::new(),
        replies_to: reply_context,
        forwarded: forwarding,
        sender_is_bot: false,
        block_level_markdown,
        correlation_id: 0,
        now,
        bot_context: None,
    };

    let chat = if let Some(c) = state.data.direct_chats.get_mut(&recipient.into()) {
        c
    } else {
        state
            .data
            .direct_chats
            .create(recipient, recipient_type.into(), state.env.rng().gen(), now)
    };

    let message_event = chat.push_message(true, push_message_args, None, Some(&mut state.data.event_store_client));

    if !recipient_type.is_self() {
        let send_message_args = SendMessageArgs {
            thread_root_message_id: thread_root_message_index.map(|i| chat.main_message_index_to_id(i)),
            message_id,
            sender_message_index: message_event.event.message_index,
            content,
            replies_to: replies_to.and_then(|r| {
                if let Some((chat, thread_root_message_index)) = r.chat_if_other {
                    Some(C2CReplyContext::OtherChat(chat, thread_root_message_index, r.event_index))
                } else {
                    chat.events
                        .main_events_reader()
                        .message_internal(r.event_index.into())
                        .map(|m| m.message_id)
                        .map(C2CReplyContext::ThisChat)
                }
            }),
            forwarding,
            block_level_markdown,
            message_filter_failed,
        };

        let sender_name = state.data.username.value.clone();
        let sender_display_name = state.data.display_name.value.clone();

        if recipient_type.user_type().is_bot() {
            ic_cdk::spawn(send_to_bot_canister(
                recipient,
                message_event.event.message_index,
                legacy_bot_api::handle_direct_message::Args::new(send_message_args, sender_name),
            ));
        } else {
            state.push_user_canister_event(
                recipient.into(),
                UserCanisterEvent::SendMessages(Box::new(SendMessagesArgs {
                    messages: vec![send_message_args],
                    sender_name,
                    sender_display_name,
                    sender_avatar_id: state.data.avatar.value.as_ref().map(|d| d.id),
                })),
            );
        }

        state
            .data
            .award_achievements_and_notify(message_event.event.achievements(true, false), now);
    }

    register_timer_jobs(
        recipient.into(),
        thread_root_message_index,
        message_id,
        &message_event,
        Vec::new(),
        now,
        &mut state.data,
    );

    if let Some(chat) = chat_private_replying_to {
        state
            .data
            .direct_chats
            .mark_private_reply(recipient, chat, message_event.event.message_index);
    }

    if let Some(transfer) = completed_transfer {
        TransferSuccessV2(TransferSuccessV2Result {
            chat_id: recipient.into(),
            event_index: message_event.index,
            message_index: message_event.event.message_index,
            timestamp: now,
            expires_at: message_event.expires_at,
            transfer,
        })
    } else {
        Success(SuccessResult {
            chat_id: recipient.into(),
            event_index: message_event.index,
            message_index: message_event.event.message_index,
            timestamp: now,
            expires_at: message_event.expires_at,
        })
    }
}

async fn send_to_bot_canister(
    recipient: UserId,
    message_index: MessageIndex,
    args: legacy_bot_api::handle_direct_message::Args,
) {
    match legacy_bot_c2c_client::handle_direct_message(recipient.into(), &args).await {
        Ok(legacy_bot_api::handle_direct_message::Response::Success(result)) => {
            mutate_state(|state| {
                if let Some(chat) = state.data.direct_chats.get_mut(&recipient.into()) {
                    let now = state.env.now();
                    for message in result.messages {
                        let push_message_args = PushMessageArgs {
                            sender: recipient,
                            thread_root_message_index: None,
                            message_id: message.message_id.unwrap_or_else(|| state.env.rng().gen()),
                            content: message.content.into(),
                            mentioned: Vec::new(),
                            replies_to: None,
                            forwarded: false,
                            sender_is_bot: false,
                            block_level_markdown: args.block_level_markdown,
                            correlation_id: 0,
                            now,
                            bot_context: None,
                        };
                        chat.push_message(false, push_message_args, None, Some(&mut state.data.event_store_client));

                        // Mark that the bot has read the message we just sent
                        chat.mark_read_up_to(message_index, false, now);
                    }
                }
            });
        }
        Err(_error) => {
            // TODO push message saying that the message failed to send
        }
    }
}

pub(crate) fn register_timer_jobs(
    chat_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    message_event: &EventWrapper<Message>,
    file_references: Vec<BlobReference>,
    now: TimestampMillis,
    data: &mut Data,
) {
    if !file_references.is_empty() {
        if let Some(expiry) = message_event.expires_at {
            data.timer_jobs.enqueue_job(
                TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files: file_references }),
                expiry,
                now,
            );
        }
    }

    if let Some(expiry) = message_event.expires_at {
        data.handle_event_expiry(expiry, now);
    }

    if let MessageContent::P2PSwap(c) = &message_event.event.content {
        data.timer_jobs.enqueue_job(
            TimerJob::MarkP2PSwapExpired(Box::new(MarkP2PSwapExpiredJob {
                chat_id,
                thread_root_message_index,
                message_id,
            })),
            c.expires_at,
            now,
        );
    }
}
