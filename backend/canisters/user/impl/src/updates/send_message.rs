use crate::crypto::process_transaction_without_caller_check;
use crate::guards::caller_is_owner;
use crate::timer_job_types::{
    DeleteFileReferencesJob, MarkP2PSwapExpiredJob, NotifyEscrowCanisterOfDepositJob, RemoveExpiredEventsJob,
};
use crate::updates::send_message_with_transfer::set_up_p2p_swap;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState, TimerJob};
use candid::Principal;
use canister_timer_jobs::TimerJobs;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, PushMessageArgs, Reader};
use event_sink_client::EventBuilder;
use ic_cdk_macros::update;
use rand::Rng;
use types::{
    BlobReference, CanisterId, Chat, ChatId, CompletedCryptoTransaction, ContentValidationError, CryptoTransaction,
    EventWrapper, Message, MessageContent, MessageContentInitial, MessageId, MessageIndex, P2PSwapLocation, TimestampMillis,
    UserId,
};
use user_canister::send_message_v2::{Response::*, *};
use user_canister::{C2CReplyContext, SendMessageArgs, SendMessagesArgs, UserCanisterEvent};
use utils::consts::{MEMO_MESSAGE, OPENCHAT_BOT_USER_ID};

// The args are mutable because if the request contains a pending transfer, we process the transfer
// and then update the message content to contain the completed transfer.
#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message_v2(mut args: Args) -> Response {
    run_regular_jobs();

    let (my_user_id, user_type) = match read_state(|state| validate_request(&args, state)) {
        ValidateRequestResult::Valid(u, t) => (u, t),
        ValidateRequestResult::Invalid(response) => return response,
        ValidateRequestResult::RecipientUnknown(u, local_user_index_canister_id) => {
            let c2c_args = local_user_index_canister::c2c_lookup_user::Args {
                user_id_or_principal: args.recipient.into(),
            };
            match local_user_index_canister_c2c_client::c2c_lookup_user(local_user_index_canister_id, &c2c_args).await {
                Ok(local_user_index_canister::c2c_lookup_user::Response::Success(result)) if result.is_bot => {
                    (u, UserType::Bot)
                }
                Ok(local_user_index_canister::c2c_lookup_user::Response::Success(_)) => (u, UserType::User),
                Ok(local_user_index_canister::c2c_lookup_user::Response::UserNotFound) => return RecipientNotFound,
                Err(error) => return InternalError(format!("{error:?}")),
            }
        }
    };

    let mut completed_transfer = None;
    let mut p2p_swap_id = None;
    // If the message includes a pending cryptocurrency transfer, we process that and then update
    // the message to contain the completed transfer.
    match &mut args.content {
        MessageContentInitial::Crypto(c) => {
            if user_type.is_self() {
                return InvalidRequest("Cannot send crypto to yourself".to_string());
            }
            let mut pending_transaction = match &c.transfer {
                CryptoTransaction::Pending(t) => t.clone().set_memo(&MEMO_MESSAGE),
                _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
            };
            if !pending_transaction.validate_recipient(args.recipient) {
                return InvalidRequest("Transaction is not to the user's account".to_string());
            }
            // When transferring to bot users, each user transfers to their own subaccount, this way it
            // is trivial for the bots to keep track of each user's funds
            if user_type.is_bot() {
                pending_transaction.set_recipient(args.recipient.into(), Principal::from(my_user_id).into());
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
        MessageContentInitial::P2PSwap(p) => {
            let (escrow_canister_id, now) = read_state(|state| (state.data.escrow_canister_id, state.env.now()));
            let create_swap_args = escrow_canister::create_swap::Args {
                location: P2PSwapLocation::from_message(Chat::Direct(args.recipient.into()), None, args.message_id),
                token0: p.token0.clone(),
                token0_amount: p.token0_amount,
                token1: p.token1.clone(),
                token1_amount: p.token1_amount,
                expires_at: now + p.expires_in,
                additional_admins: Vec::new(),
                canister_to_notify: Some(args.recipient.into()),
            };
            match set_up_p2p_swap(escrow_canister_id, create_swap_args).await {
                Ok((swap_id, pending_transaction)) => {
                    (completed_transfer, p2p_swap_id) =
                        match process_transaction_without_caller_check(pending_transaction).await {
                            Ok(completed) => {
                                NotifyEscrowCanisterOfDepositJob::run(swap_id);
                                (Some(completed), Some(swap_id))
                            }
                            Err(failed) => {
                                return TransferFailed(failed.error_message().to_string());
                            }
                        };
                }
                Err(error) => return error.into(),
            }
        }
        _ => {}
    };

    mutate_state(|state| send_message_impl(args, completed_transfer, p2p_swap_id, user_type, state))
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
    Valid(UserId, UserType),
    Invalid(Response),
    RecipientUnknown(UserId, CanisterId), // UserId, UserIndexCanisterId
}

fn validate_request(args: &Args, state: &RuntimeState) -> ValidateRequestResult {
    if state.data.suspended.value {
        return ValidateRequestResult::Invalid(UserSuspended);
    }
    if state.data.blocked_users.contains(&args.recipient) {
        return ValidateRequestResult::Invalid(RecipientBlocked);
    }
    if args.recipient == OPENCHAT_BOT_USER_ID {
        return ValidateRequestResult::Invalid(InvalidRequest(
            "Messaging the OpenChat Bot is not currently supported".to_string(),
        ));
    }
    if let Some(chat) = state.data.direct_chats.get(&args.recipient.into()) {
        if chat
            .events
            .contains_message_id(args.thread_root_message_index, args.message_id)
        {
            return ValidateRequestResult::Invalid(DuplicateMessageId);
        }
    }

    let now = state.env.now();
    let my_user_id: UserId = state.env.canister_id().into();

    if let Err(error) = args.content.validate_for_new_message(true, false, args.forwarding, now) {
        ValidateRequestResult::Invalid(match error {
            ContentValidationError::Empty => MessageEmpty,
            ContentValidationError::TextTooLong(max_length) => TextTooLong(max_length),
            ContentValidationError::InvalidPoll(reason) => InvalidPoll(reason),
            ContentValidationError::TransferCannotBeZero => TransferCannotBeZero,
            ContentValidationError::InvalidTypeForForwarding => {
                InvalidRequest("Cannot forward this type of message".to_string())
            }
            ContentValidationError::PrizeEndDateInThePast => unreachable!(),
            ContentValidationError::Unauthorized => {
                InvalidRequest("User unauthorized to send messages of this type".to_string())
            }
        })
    } else if args.recipient == my_user_id {
        if matches!(
            args.content,
            MessageContentInitial::Crypto(_) | MessageContentInitial::P2PSwap(_)
        ) {
            ValidateRequestResult::Invalid(TransferCannotBeToSelf)
        } else {
            ValidateRequestResult::Valid(my_user_id, UserType::_Self)
        }
    } else if let Some(chat) = state.data.direct_chats.get(&args.recipient.into()) {
        let user_type = if chat.is_bot {
            if matches!(args.content, MessageContentInitial::P2PSwap(_)) {
                return ValidateRequestResult::Invalid(InvalidRequest("Cannot open a P2P swap with a bot".to_string()));
            }
            UserType::Bot
        } else {
            UserType::User
        };
        ValidateRequestResult::Valid(my_user_id, user_type)
    } else {
        ValidateRequestResult::RecipientUnknown(my_user_id, state.data.local_user_index_canister_id)
    }
}

fn send_message_impl(
    args: Args,
    completed_transfer: Option<CompletedCryptoTransaction>,
    p2p_swap_id: Option<u32>,
    user_type: UserType,
    state: &mut RuntimeState,
) -> Response {
    let now = state.env.now();
    let this_canister_id = state.env.canister_id();
    let sender: UserId = this_canister_id.into();
    let recipient = args.recipient;
    let content = if let Some(transfer) = completed_transfer.clone() {
        MessageContentInternal::new_with_transfer(args.content.clone(), transfer, p2p_swap_id, now)
    } else {
        args.content.into()
    };

    let push_message_args = PushMessageArgs {
        thread_root_message_index: None,
        message_id: args.message_id,
        sender,
        content: content.clone(),
        mentioned: Vec::new(),
        replies_to: args.replies_to.as_ref().map(|r| r.into()),
        forwarded: args.forwarding,
        sender_is_bot: false,
        correlation_id: args.correlation_id,
        now,
    };

    let chat = if let Some(c) = state.data.direct_chats.get_mut(&recipient.into()) {
        c
    } else {
        state
            .data
            .direct_chats
            .create(recipient, user_type.is_bot(), state.env.rng().gen(), now)
    };

    let (message_event, event_payload) = chat.push_message(true, push_message_args, None);

    let mut is_next_event_to_expire = false;
    if let Some(expiry) = message_event.expires_at {
        is_next_event_to_expire = state.data.next_event_expiry.map_or(true, |ex| expiry < ex);
        if is_next_event_to_expire {
            state.data.next_event_expiry = Some(expiry);
        }
    }

    register_timer_jobs(
        recipient.into(),
        args.message_id,
        &message_event,
        Vec::new(),
        is_next_event_to_expire,
        now,
        &mut state.data.timer_jobs,
    );

    let user_string = sender.to_string();
    state.data.event_sink_client.push(
        EventBuilder::new("message_sent", now)
            .with_user(user_string.clone())
            .with_source(user_string)
            .with_json_payload(&event_payload)
            .build(),
    );

    if !user_type.is_self() {
        let send_message_args = SendMessageArgs {
            message_id: args.message_id,
            sender_message_index: message_event.event.message_index,
            content,
            replies_to: args.replies_to.and_then(|r| {
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
            forwarding: args.forwarding,
            message_filter_failed: args.message_filter_failed,
        };

        let sender_name = state.data.username.value.clone();
        let sender_display_name = state.data.display_name.value.clone();

        if user_type.is_bot() {
            ic_cdk::spawn(send_to_bot_canister(
                recipient,
                message_event.event.message_index,
                bot_api::handle_direct_message::Args::new(send_message_args, sender_name),
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

async fn send_to_bot_canister(recipient: UserId, message_index: MessageIndex, args: bot_api::handle_direct_message::Args) {
    match bot_c2c_client::handle_direct_message(recipient.into(), &args).await {
        Ok(bot_api::handle_direct_message::Response::Success(result)) => {
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
                            correlation_id: 0,
                            now,
                        };
                        chat.push_message(false, push_message_args, None);

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
    message_id: MessageId,
    message_event: &EventWrapper<Message>,
    file_references: Vec<BlobReference>,
    is_next_event_to_expire: bool,
    now: TimestampMillis,
    timer_jobs: &mut TimerJobs<TimerJob>,
) {
    if !file_references.is_empty() {
        if let Some(expiry) = message_event.expires_at {
            timer_jobs.enqueue_job(
                TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files: file_references }),
                expiry,
                now,
            );
        }
    }

    if let Some(expiry) = message_event.expires_at.filter(|_| is_next_event_to_expire) {
        timer_jobs.cancel_jobs(|j| matches!(j, TimerJob::RemoveExpiredEvents(_)));
        timer_jobs.enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
    }

    if let MessageContent::P2PSwap(c) = &message_event.event.content {
        timer_jobs.enqueue_job(
            TimerJob::MarkP2PSwapExpired(Box::new(MarkP2PSwapExpiredJob {
                chat_id,
                thread_root_message_index: None,
                message_id,
            })),
            c.expires_at,
            now,
        );
    }
}
