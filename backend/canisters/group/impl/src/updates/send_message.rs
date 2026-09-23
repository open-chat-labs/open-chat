use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::timer_job_types::{
    CancelP2PSwapInEscrowCanisterJob, DeleteFileReferencesJob, EndPollJob, FinalPrizePaymentsJob, MakeTransferJob,
    MarkP2PSwapExpiredJob, NotifyEscrowCanisterOfSwapFundedJob,
};
use crate::{Data, GroupEventPusher, RuntimeState, TimerJob, execute_update, execute_update_async, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_timer_jobs::Job;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, ValidateNewMessageContentResult};
use constants::{MEMO_MESSAGE, MEMO_PRIZE};
use group_canister::c2c_bot_send_message;
use group_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use group_canister::send_message_v2::{Response::*, *};
use group_chat_core::SendMessageSuccess;
use group_community_common::{NewP2PSwap, prize_refund, validate_prize};
use ledger_utils::UserTransfer;
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::{
    Achievement, BotCaller, BotPermissions, Caller, CanisterId, Chat, ChatId, CompletedCryptoTransaction, EventIndex,
    EventWrapper, GroupChatUserNotificationPayload, GroupMessageNotification, Message, MessageContent, MessageContentInitial,
    MessageContentType, MessageIndex, OCResult, P2PSwapLocation, TimestampMillis, User, UserIdAndPrincipal, UserType, icrc1,
    icrc2,
};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
async fn send_message_v2(args: Args) -> Response {
    let result = if args.content.has_transfer_to_make() {
        execute_update_async(|| send_message_with_transfer(args)).await
    } else {
        execute_update(|state| send_message_impl(args, None, true, state))
    };

    match result {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[update(msgpack = true)]
#[trace]
fn c2c_send_message(args: C2CArgs) -> C2CResponse {
    match execute_update(|state| c2c_send_message_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_send_message(args: c2c_bot_send_message::Args) -> c2c_bot_send_message::Response {
    execute_update(|state| c2c_bot_send_message_impl(args, state))
}

fn c2c_bot_send_message_impl(args: c2c_bot_send_message::Args, state: &mut RuntimeState) -> c2c_bot_send_message::Response {
    let finalised = args.finalised;
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };
    let args: Args = args.into();

    if !state.data.is_bot_permitted(
        &bot_caller.bot,
        &bot_caller.initiator,
        &BotPermissions::from_message_permission((&args.content).into()),
    ) {
        return Error(OCErrorCode::InitiatorNotAuthorized.into());
    }

    match send_message_impl(args, Some(Caller::BotV2(bot_caller)), finalised, state) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

pub(crate) fn send_message_impl(
    args: Args,
    ext_caller: Option<Caller>,
    finalised: bool,
    state: &mut RuntimeState,
) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    if state.data.chat.external_url.is_some() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let caller = state.verified_caller(ext_caller)?;

    let now = state.env.now();
    let mentioned: Vec<_> = args.mentioned.iter().map(|u| u.user_id).collect();

    let content =
        match MessageContentInternal::validate_new_message(args.content, false, (&caller).into(), args.forwarding, now) {
            ValidateNewMessageContentResult::Success(content) => content,
            ValidateNewMessageContentResult::Error(error) => return Err(error.into()),
            _ => return Err(OCErrorCode::InvalidRequest.with_message("Message type not supported")),
        };

    let result = state.data.chat.send_message(
        &caller,
        args.thread_root_message_index,
        args.message_id,
        content,
        args.replies_to,
        &mentioned,
        args.forwarding,
        args.rules_accepted,
        args.message_filter_failed.is_some(),
        args.block_level_markdown,
        GroupEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
        finalised,
        args.og_previews,
        now,
    )?;

    Ok(process_send_message_result(
        result,
        &caller,
        args.sender_name,
        args.sender_display_name,
        args.thread_root_message_index,
        args.mentioned,
        now,
        args.new_achievement,
        state,
    ))
}

fn c2c_send_message_impl(args: C2CArgs, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    if state.data.is_frozen() {
        return Err(OCErrorCode::ChatFrozen.into());
    }

    let caller = state.verified_caller(None)?;

    // Bots can't call this c2c endpoint since it skips the validation
    if matches!(caller, Caller::Bot(_) | Caller::BotV2(_)) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    send_message_with_completed_transfer(&caller, args, false, state)
}

// Sends a message whose content has been validated already, and whose transfer, if it holds one,
// has been made
pub(crate) fn send_message_with_completed_transfer(
    caller: &Caller,
    args: C2CArgs,
    new_achievement: bool,
    state: &mut RuntimeState,
) -> OCResult<SuccessResult> {
    let mut content = args.content;
    // Recorded so the prize can be refunded to the sender's wallet even if they have left
    if let MessageContentInternal::Prize(prize) = &mut content {
        prize.principal = match caller {
            Caller::User(user) => user.principal,
            _ => state.member_user(caller.agent()).principal,
        };
    }

    let now = state.env.now();
    let mentioned: Vec<_> = args.mentioned.iter().map(|u| u.user_id).collect();
    let result = state.data.chat.send_message(
        caller,
        args.thread_root_message_index,
        args.message_id,
        content,
        args.replies_to,
        &mentioned,
        args.forwarding,
        args.rules_accepted,
        args.message_filter_failed.is_some(),
        args.block_level_markdown,
        GroupEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
        true,
        args.og_previews,
        now,
    )?;

    Ok(process_send_message_result(
        result,
        caller,
        args.sender_name,
        args.sender_display_name,
        args.thread_root_message_index,
        args.mentioned,
        now,
        new_achievement,
        state,
    ))
}

#[expect(clippy::too_many_arguments)]
fn process_send_message_result(
    result: SendMessageSuccess,
    caller: &Caller,
    sender_username: String,
    sender_display_name: Option<String>,
    thread_root_message_index: Option<MessageIndex>,
    mentioned: Vec<User>,
    now: TimestampMillis,
    new_achievement: bool,
    state: &mut RuntimeState,
) -> SuccessResult {
    let message_event = &result.message_event;
    let event_index = message_event.index;
    let message_index = message_event.event.message_index;
    let message_id = message_event.event.message_id;
    let expires_at = message_event.expires_at;

    register_timer_jobs(thread_root_message_index, message_event, now, &mut state.data);

    if state.data.chat.is_public.value {
        let input = message_event.event.content.moderation_input();
        if !input.is_empty() {
            state.queue_message_for_moderation(thread_root_message_index, message_id, input);
        }
        // Deliberately a sibling of the classification gate, not nested inside it: `input` is
        // empty for an image with no caption, which is exactly the message media scanning
        // must not skip
        let blobs = message_event.event.content.scannable_blobs();
        if !blobs.is_empty() {
            state.queue_media_for_scanning(thread_root_message_index, message_id, blobs);
        }
    }

    if !result.unfinalised_bot_message {
        let chat_id: ChatId = state.env.canister_id().into();
        let sender = caller.agent();
        let content = &message_event.event.content;
        let notification = GroupChatUserNotificationPayload::GroupMessage(GroupMessageNotification {
            chat_id,
            thread_root_message_index,
            message_index,
            event_index,
            group_name: state.data.chat.name.value.clone(),
            sender,
            sender_name: sender_username,
            sender_display_name,
            message_type: content.content_type().to_string(),
            message_text: content.notification_text(&mentioned, &[]),
            image_url: content.notification_image_url(),
            file_name: content.notification_file_name(),
            group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
            crypto_transfer: content.notification_crypto_transfer_details(&mentioned),
            call: None,
        });
        state.push_notification(Some(sender), result.users_to_notify, notification);

        if new_achievement && !caller.is_bot() {
            for a in message_event.event.achievements(false, thread_root_message_index.is_some()) {
                state.notify_user_of_achievement(sender, a, now);
            }
        }

        let mut activity_events = Vec::new();

        if let MessageContent::Crypto(c) = content
            && state
                .data
                .chat
                .members
                .get(&c.recipient)
                .is_some_and(|m| !m.user_type().is_bot())
        {
            state.notify_user_of_achievement(c.recipient, Achievement::ReceivedCrypto, now);
            activity_events.push((c.recipient, MessageActivity::Crypto));
        }

        for user in mentioned {
            if caller.initiator().map(|i| i != user.user_id).unwrap_or_default()
                && state
                    .data
                    .chat
                    .members
                    .get(&user.user_id)
                    .is_some_and(|m| !m.user_type().is_bot())
            {
                activity_events.push((user.user_id, MessageActivity::Mention));
            }
        }

        if let Some(replying_to_event_index) = message_event
            .event
            .replies_to
            .as_ref()
            .filter(|r| r.chat_if_other.is_none())
            .map(|r| r.event_index)
            && let Some((message, _)) = state.data.chat.events.message_internal(
                EventIndex::default(),
                thread_root_message_index,
                replying_to_event_index.into(),
            )
            && caller.initiator().map(|i| i != message.sender).unwrap_or_default()
            && state
                .data
                .chat
                .members
                .get(&message.sender)
                .is_some_and(|m| !m.user_type().is_bot())
        {
            activity_events.push((message.sender, MessageActivity::QuoteReply));
        }

        for (user_id, activity) in activity_events {
            state.push_event_to_user(
                user_id,
                GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                    chat: Chat::Group(chat_id),
                    thread_root_message_index,
                    message_index,
                    message_id,
                    event_index,
                    activity,
                    timestamp: now,
                    user_id: Some(sender),
                }),
                now,
            );
        }
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);

    SuccessResult {
        event_index,
        message_index,
        timestamp: now,
        expires_at,
        transfer: None,
    }
}

fn register_timer_jobs(
    thread_root_message_index: Option<MessageIndex>,
    message_event: &EventWrapper<Message>,
    now: TimestampMillis,
    data: &mut Data,
) {
    let files = message_event.event.content.blob_references();
    if !files.is_empty()
        && let Some(expiry) = message_event.expires_at
    {
        data.timer_jobs
            .enqueue_job(TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files }), expiry, now);
    }

    if let Some(expiry) = message_event.expires_at {
        data.handle_event_expiry(expiry, now);
    }

    match &message_event.event.content {
        MessageContent::Poll(p) => {
            if let Some(end_date) = p.config.end_date {
                data.timer_jobs.enqueue_job(
                    TimerJob::EndPoll(EndPollJob {
                        thread_root_message_index,
                        message_index: message_event.event.message_index,
                    }),
                    end_date,
                    now,
                );
            }
        }
        MessageContent::Prize(p) => {
            data.timer_jobs.enqueue_job(
                TimerJob::FinalPrizePayments(FinalPrizePaymentsJob {
                    message_index: message_event.event.message_index,
                }),
                p.end_date,
                now,
            );
        }
        MessageContent::P2PSwap(c) => {
            data.timer_jobs.enqueue_job(
                TimerJob::MarkP2PSwapExpired(MarkP2PSwapExpiredJob {
                    thread_root_message_index,
                    message_id: message_event.event.message_id,
                }),
                c.expires_at,
                now,
            );
        }
        _ => {}
    }
}

// Sends a message holding a transfer the sender makes from their own funds, making the transfer
// first. See `send_message_v2::Args` for which transfers are accepted.
async fn send_message_with_transfer(args: Args) -> OCResult<SuccessResult> {
    let (user, prepared) = mutate_state(|state| prepare_transfer(&args, state))?;
    let user_id = user.user_id;

    match prepared {
        // The transfer was certified, so the message has been sent already
        PrepareTransferResult::Sent(result) => Ok(result),
        PrepareTransferResult::Icrc2(transfer) => {
            let from = transfer.from;
            let completed: CompletedCryptoTransaction =
                match ledger_utils::icrc2::process_transaction_for_user(transfer, ledger_utils::spender_subaccount(user_id))
                    .await
                {
                    Ok(Ok(completed)) => completed.into(),
                    Ok(Err((_, error))) => return Err(error),
                    Err(error) => return Err(error.into()),
                };

            let (result, now) = mutate_state(|state| {
                (
                    send_message_holding_transfer(user, &args, completed.clone(), None, state),
                    state.env.now(),
                )
            });
            if let Err(error) = &result {
                error!(?error, "Failed to send message after making its transfer");
                if matches!(args.content, MessageContentInitial::Prize(_))
                    && let Some(refund) = prize_refund(&completed, from, now)
                {
                    MakeTransferJob {
                        pending_transaction: refund,
                        attempt: 0,
                    }
                    .execute();
                }
            }
            result
        }
        PrepareTransferResult::P2PSwap(swap) => {
            let offered_by = swap.swap.offered_by();
            let (swap_id, completed) = match swap
                .swap
                .create(swap.escrow_canister_id, swap.local_user_index_canister_id, swap.now)
                .await
            {
                Ok(ok) => ok,
                Err((error, swap_id)) => {
                    if let Some(swap_id) = swap_id {
                        cancel_p2p_swap(swap_id, offered_by);
                    }
                    return Err(error);
                }
            };

            let result = mutate_state(|state| send_message_holding_transfer(user, &args, completed, Some(swap_id), state));
            match &result {
                Ok(_) => NotifyEscrowCanisterOfSwapFundedJob::run(swap_id, offered_by),
                Err(error) => {
                    error!(?error, "Failed to send message after funding its P2P swap");
                    cancel_p2p_swap(swap_id, offered_by);
                }
            }
            result
        }
    }
}

// Cancels a swap which may have been funded. The Escrow canister is only notified of the funding once
// the swap is cancelled, so that it refunds any deposit. Were it notified first, it could record the
// deposit as received after the cancellation, which refunds nothing not yet received.
fn cancel_p2p_swap(swap_id: u32, offered_by: Principal) {
    CancelP2PSwapInEscrowCanisterJob::run(swap_id);
    NotifyEscrowCanisterOfSwapFundedJob::run(swap_id, offered_by);
}

enum PrepareTransferResult {
    Sent(SuccessResult),
    Icrc2(icrc2::PendingCryptoTransaction),
    P2PSwap(Box<P2PSwapToCreate>),
}

struct P2PSwapToCreate {
    swap: NewP2PSwap,
    escrow_canister_id: CanisterId,
    local_user_index_canister_id: CanisterId,
    now: TimestampMillis,
}

fn prepare_transfer(args: &Args, state: &mut RuntimeState) -> OCResult<(UserIdAndPrincipal, PrepareTransferResult)> {
    state.data.verify_not_frozen()?;

    if state.data.chat.external_url.is_some() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let Caller::User(user) = state.verified_caller(None)? else {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };
    let user_id = user.user_id;

    let now = state.env.now();
    let this_canister_id = state.env.canister_id();

    let (content_type, memo, transfer, recipient) =
        match MessageContentInternal::validate_new_message(args.content.clone(), false, UserType::User, args.forwarding, now) {
            ValidateNewMessageContentResult::SuccessCrypto(c) => {
                if c.recipient == user_id {
                    return Err(OCErrorCode::TransferCannotBeToSelf.into());
                }
                let recipient = state.member_wallet(c.recipient)?;
                (MessageContentType::Crypto, MEMO_MESSAGE.as_slice(), c.transfer, recipient)
            }
            ValidateNewMessageContentResult::SuccessPrize(p) => {
                validate_prize(&p, args.thread_root_message_index)?;
                // The group holds the prize, paying out each winner's share from its own account
                let recipient = icrc1::Account::from(this_canister_id);
                (MessageContentType::Prize, MEMO_PRIZE.as_slice(), p.transfer, recipient)
            }
            ValidateNewMessageContentResult::SuccessP2PSwap(p) => {
                state.data.chat.check_can_send_message(
                    user_id,
                    args.thread_root_message_index,
                    args.message_id,
                    MessageContentType::P2PSwap,
                    args.rules_accepted,
                )?;
                let location = P2PSwapLocation::from_message(
                    Chat::Group(this_canister_id.into()),
                    args.thread_root_message_index,
                    args.message_id,
                );
                let swap = NewP2PSwap::new(&p, location, user_id, state.member_wallet(user_id)?, this_canister_id, now)?;
                return Ok((
                    user,
                    PrepareTransferResult::P2PSwap(Box::new(P2PSwapToCreate {
                        swap,
                        escrow_canister_id: state.data.escrow_canister_id,
                        local_user_index_canister_id: state.data.local_user_index_canister_id,
                        now,
                    })),
                ));
            }
            ValidateNewMessageContentResult::Error(error) => return Err(error.into()),
            ValidateNewMessageContentResult::Success(_) => {
                return Err(OCErrorCode::InvalidRequest.with_message("Message must include a crypto transfer"));
            }
        };

    let transfer = UserTransfer::new(transfer, recipient, memo, this_canister_id)?;

    state.data.chat.check_can_send_message(
        user_id,
        args.thread_root_message_index,
        args.message_id,
        content_type,
        args.rules_accepted,
    )?;

    match transfer {
        UserTransfer::Icrc2(transfer) => Ok((user, PrepareTransferResult::Icrc2(transfer))),
        UserTransfer::Certified(transfer) => {
            let completed = state.data.certified_transfers.verify(
                transfer,
                state.env.caller(),
                memo,
                this_canister_id,
                &state.env.ic_root_key(),
                now,
            )?;
            let result = send_message_holding_transfer(user, args, completed.clone().into(), None, state)?;
            state.data.certified_transfers.mark_used(&completed, now);
            Ok((user, PrepareTransferResult::Sent(result)))
        }
    }
}

fn send_message_holding_transfer(
    user: UserIdAndPrincipal,
    args: &Args,
    transfer: CompletedCryptoTransaction,
    p2p_swap_id: Option<u32>,
    state: &mut RuntimeState,
) -> OCResult<SuccessResult> {
    let now = state.env.now();
    let content = MessageContentInternal::new_with_transfer(args.content.clone(), transfer.clone().into(), p2p_swap_id, now);

    let c2c_args = C2CArgs {
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        content,
        sender_name: args.sender_name.clone(),
        sender_display_name: args.sender_display_name.clone(),
        replies_to: args.replies_to.clone(),
        mentioned: args.mentioned.clone(),
        forwarding: false,
        block_level_markdown: args.block_level_markdown,
        rules_accepted: args.rules_accepted,
        message_filter_failed: args.message_filter_failed,
        og_previews: args.og_previews.clone(),
    };

    let result = send_message_with_completed_transfer(&Caller::User(user), c2c_args, args.new_achievement, state)?;

    Ok(SuccessResult {
        transfer: Some(transfer),
        ..result
    })
}
