use crate::crypto::{process_transaction_without_caller_check, user_wallet, validate_from_account};
use crate::guards::{caller_is_local_user_index, caller_is_owner};
use crate::timer_job_types::{DeleteFileReferencesJob, MarkP2PSwapExpiredJob, NotifyEscrowCanisterOfDepositJob};
use crate::updates::send_message_with_transfer::set_up_p2p_swap;
use crate::{Data, RuntimeState, TimerJob, UserEventPusher, execute_update, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, PushMessageArgs, Reader, ReplyContextInternal, ValidateNewMessageContentResult};
use constants::{MEMO_MESSAGE, OPENCHAT_BOT_USER_ID};
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use types::{
    BlobReference, CanisterId, Chat, ChatId, CompletedCryptoTransaction, CryptoTransaction, EventWrapper, Message,
    MessageContent, MessageContentInitial, MessageId, MessageIndex, OCResult, OgPreview, P2PSwapLocation, ReplyContext,
    TimestampMillis, UserId, UserType,
};
use user_canister::send_message_v2::{Response::*, *};
use user_canister::{C2CReplyContext, SendMessageArgs, SendMessagesArgs, UserCanisterEvent, c2c_bot_send_message};
use user_core::updates::c2c_bot_send_message::Sent;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn send_message_v2(args: Args) -> Response {
    execute_update_async(|| send_message_v2_impl(args)).await
}

async fn send_message_v2_impl(mut args: Args) -> Response {
    let PrepareOk {
        my_user_id,
        now,
        local_user_index_canister_id,
        maybe_recipient_type,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let recipient_type = if let Some(recipient_type) = maybe_recipient_type {
        recipient_type
    } else {
        let c2c_args = local_user_index_canister::c2c_lookup_user::Args {
            user_id_or_principal: args.recipient.as_principal(),
        };
        match local_user_index_canister_c2c_client::c2c_lookup_user(local_user_index_canister_id, &c2c_args).await {
            Ok(local_user_index_canister::c2c_lookup_user::Response::Success(result)) => RecipientType::Other(result.user_type),
            Ok(local_user_index_canister::c2c_lookup_user::Response::UserNotFound) => {
                return Error(OCErrorCode::TargetUserNotFound.into());
            }
            Err(error) => return Error(error.into()),
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

                let recipient = match user_wallet(args.recipient, local_user_index_canister_id).await {
                    Ok(recipient) => recipient,
                    Err(error) => return Error(error),
                };
                if !pending_transfer.validate_recipient(recipient) {
                    return Error(OCErrorCode::InvalidRequest.with_message("Transaction is not to the user's account"));
                }

                if let Err(error) = mutate_state(|state| state.data.user.pin_number.verify(args.pin.as_mut(), now)) {
                    return Error(error.into());
                }

                // When transferring to bot users, each user transfers to their own subaccount, this way it
                // is trivial for the bots to keep track of each user's funds
                if recipient_type.user_type().is_bot() {
                    pending_transfer.set_recipient(args.recipient.as_principal(), my_user_id.as_principal().into());
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
                    Ok(Err((_, error))) => return Error(error),
                    Err(error) => return Error(error.into()),
                }
            }
            ValidateNewMessageContentResult::SuccessPrize(_) => unreachable!(),
            ValidateNewMessageContentResult::SuccessP2PSwap(content) => {
                let (escrow_canister_id, now, is_diamond, my_user_id) = read_state(|state| {
                    let now = state.env.now();
                    (
                        state.data.escrow_canister_id,
                        now,
                        state.data.user.membership(now).is_diamond_member(),
                        UserId::from(state.env.canister_id()),
                    )
                });
                if !is_diamond {
                    return Error(OCErrorCode::NotDiamondMember.into());
                }
                if let Err(error) = validate_from_account(content.from_account, my_user_id) {
                    return Error(error);
                }
                let create_swap_args = escrow_canister::create_swap::Args {
                    location: P2PSwapLocation::from_message(Chat::Direct(args.recipient.into()), None, args.message_id),
                    token0: content.token0.clone(),
                    token0_amount: content.token0_amount,
                    token0_principal: None,
                    token1: content.token1.clone(),
                    token1_amount: content.token1_amount,
                    token1_principal: None,
                    expires_at: now + content.expires_in,
                    additional_admins: Vec::new(),
                    canister_to_notify: Some(args.recipient.canister_id()),
                    is_public: false,
                };
                match set_up_p2p_swap(escrow_canister_id, create_swap_args, content.from_account).await {
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
                            Ok(Err((_, error))) => return Error(error),
                            Err(error) => return Error(error.into()),
                        }
                    }
                    Err(error) => return Error(error),
                }
            }
            ValidateNewMessageContentResult::Error(error) => {
                return Error(OCErrorCode::InvalidMessageContent.with_json(&error));
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
            args.og_previews,
            state,
        )
    })
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_send_message(args: c2c_bot_send_message::Args) -> c2c_bot_send_message::Response {
    execute_update(|state| c2c_bot_send_message_impl(args, state))
}

fn c2c_bot_send_message_impl(args: c2c_bot_send_message::Args, state: &mut RuntimeState) -> c2c_bot_send_message::Response {
    let now = state.env.now();
    let my_user_id = state.env.canister_id().into();
    let bot_id = args.bot_id;
    let message_id = args.message_id;

    let message = match user_core::updates::c2c_bot_send_message::prepare(&state.data.user, args, now) {
        Ok(message) => message,
        Err(error) => return c2c_bot_send_message::Response::Error(error),
    };

    // Drawn up front, whether or not the chat turns out to need creating, since the rng is also
    // borrowed by the event pusher
    let anonymized_chat_id: u128 = state.env.rng().random();

    let Sent {
        result,
        notification,
        new_message,
    } = match user_core::updates::c2c_bot_send_message::send(
        &mut state.data.user,
        my_user_id,
        message,
        || anonymized_chat_id,
        Some(UserEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        }),
        now,
    ) {
        Ok(sent) => sent,
        Err(error) => return c2c_bot_send_message::Response::Error(error),
    };

    if let Some(notification) = notification {
        state.push_notification(Some(bot_id), my_user_id, notification);
    }

    if let Some((message_event, files)) = new_message {
        register_timer_jobs(bot_id.into(), None, message_id, &message_event, files, now, &mut state.data);
    }

    c2c_bot_send_message::Response::Success(result)
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

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareOk> {
    state.data.user.verify_not_suspended()?;

    if state.data.user.blocked_users.contains(&args.recipient) {
        return Err(OCErrorCode::TargetUserBlocked.into());
    }

    if args.recipient == OPENCHAT_BOT_USER_ID {
        return Err(OCErrorCode::InvalidRequest.with_message("Messaging the OpenChat Bot is not currently supported"));
    }

    let my_user_id = state.env.canister_id().into();
    let maybe_recipient_type = if let Some(chat) = state.data.user.direct_chats.get(&args.recipient.into()) {
        if chat
            .events()
            .message_already_finalised(args.thread_root_message_index, args.message_id, false)
        {
            return Err(OCErrorCode::MessageIdAlreadyExists.into());
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

#[expect(clippy::too_many_arguments)]
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
    og_previews: Vec<OgPreview>,
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
        og_previews: og_previews.clone(),
        now,
        sender_context: None,
    };

    let chat = state.data.user.direct_chats.get_or_create(
        my_user_id,
        recipient,
        recipient_type.into(),
        || state.env.rng().random(),
        now,
    );

    // Checked before the message is pushed, since pushing a message to a thread creates the thread
    let thread_root_message_id = match chat.thread_root_message_id(thread_root_message_index) {
        Ok(id) => id,
        Err(error) => return Error(error),
    };

    let message_event = chat.push_message(
        push_message_args,
        None,
        Some(UserEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        }),
    );

    if !recipient_type.is_self() {
        let send_message_args = SendMessageArgs {
            thread_root_message_id,
            message_id,
            sender_message_index: message_event.event.message_index,
            content,
            replies_to: replies_to.and_then(|r| {
                if let Some((chat, thread_root_message_index)) = r.chat_if_other {
                    Some(C2CReplyContext::OtherChat(chat, thread_root_message_index, r.event_index))
                } else {
                    chat.events()
                        .main_events_reader()
                        .message_internal(r.event_index.into())
                        .map(|m| m.message_id)
                        .map(C2CReplyContext::ThisChat)
                }
            }),
            forwarding,
            block_level_markdown,
            message_filter_failed,
            og_previews,
        };

        let sender_name = state.data.user.username.value.clone();
        let sender_display_name = state.data.user.display_name.value.clone();

        if recipient_type.user_type().is_bot() {
            ic_cdk::futures::spawn_migratory(send_to_bot_canister(
                recipient,
                message_event.event.message_index,
                legacy_bot_api::handle_direct_message::Args::new(send_message_args, sender_name),
            ));
        } else {
            state.push_user_canister_event(
                recipient,
                UserCanisterEvent::SendMessages(Box::new(SendMessagesArgs {
                    messages: vec![send_message_args],
                    sender_name,
                    sender_display_name,
                    sender_avatar_id: state.data.user.avatar.id(),
                })),
            );
        }

        state.award_achievements_and_notify(message_event.event.achievements(true, false), now);
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
            .user
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
    match legacy_bot_c2c_client::handle_direct_message(recipient.canister_id(), &args).await {
        Ok(legacy_bot_api::handle_direct_message::Response::Success(result)) => {
            mutate_state(|state| {
                if let Some(chat) = state.data.user.direct_chats.get_mut(&recipient.into()) {
                    let now = state.env.now();
                    for message in result.messages {
                        let push_message_args = PushMessageArgs {
                            sender: recipient,
                            thread_root_message_index: None,
                            message_id: message.message_id.unwrap_or_else(|| state.env.rng().random()),
                            content: message.content.into(),
                            mentioned: Vec::new(),
                            replies_to: None,
                            forwarded: false,
                            sender_is_bot: false,
                            block_level_markdown: args.block_level_markdown,
                            og_previews: message.og_previews.unwrap_or_default(),
                            now,
                            sender_context: None,
                        };
                        chat.push_message(
                            push_message_args,
                            None,
                            Some(UserEventPusher {
                                now,
                                rng: state.env.rng(),
                                queue: &mut state.data.local_user_index_event_sync_queue,
                            }),
                        );

                        // Mark that the bot has read the message we just sent
                        chat.mark_read_by_them_up_to(message_index, now);
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
    if !file_references.is_empty()
        && let Some(expiry) = message_event.expires_at
    {
        data.timer_jobs.enqueue_job(
            TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files: file_references }),
            expiry,
            now,
        );
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
