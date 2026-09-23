use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::model::members::CommunityMembers;
use crate::model::user_groups::UserGroup;
use crate::timer_job_types::{
    CancelP2PSwapInEscrowCanisterJob, DeleteFileReferencesJob, EndPollJob, FinalPrizePaymentsJob, MakeTransferJob,
    MarkP2PSwapExpiredJob, NotifyEscrowCanisterOfSwapFundedJob, TimerJob,
};
use crate::{CommunityEventPusher, Data, RuntimeState, execute_update, execute_update_async, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_timer_jobs::Job;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, ValidateNewMessageContentResult};
use community_canister::c2c_bot_send_message;
use community_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use community_canister::send_message::{Response::*, *};
use constants::{MEMO_MESSAGE, MEMO_PRIZE};
use group_chat_core::SendMessageSuccess;
use group_community_common::{MemberTransfer, NewP2PSwap, prize_refund, validate_prize};
use itertools::Itertools;
use lazy_static::lazy_static;
use oc_error_codes::OCErrorCode;
use regex_lite::Regex;
use std::str::FromStr;
use tracing::error;
use types::{
    Achievement, BotCaller, BotPermissions, Caller, CanisterId, ChannelId, ChannelMessageNotification,
    ChannelUserNotificationPayload, Chat, CommunityId, CompletedCryptoTransaction, EventIndex, EventWrapper, Message,
    MessageContent, MessageContentInitial, MessageContentType, MessageIndex, OCResult, P2PSwapLocation, TimestampMillis, User,
    UserId, UserIdAndPrincipal, UserType, Version, icrc2,
};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
async fn send_message(args: Args) -> Response {
    let result = if args.content.contains_crypto_transfer() {
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
        Some(args.channel_id),
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
    let caller = state.verified_caller(ext_caller)?;

    let display_name = prepare(&caller, args.community_rules_accepted, state)?;

    let now = state.env.now();
    let content =
        match MessageContentInternal::validate_new_message(args.content, false, (&caller).into(), args.forwarding, now) {
            ValidateNewMessageContentResult::Success(content) => content,
            ValidateNewMessageContentResult::Error(error) => return Err(error.into()),
            _ => return Err(OCErrorCode::InvalidRequest.with_message("Message type not supported")),
        };

    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    if channel.chat.external_url.is_some() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let users_mentioned = extract_users_mentioned(args.mentioned, content.text(), &state.data.members);

    let result = channel.chat.send_message(
        &caller,
        args.thread_root_message_index,
        args.message_id,
        content,
        args.replies_to,
        &users_mentioned.all_users_mentioned,
        args.forwarding,
        args.channel_rules_accepted,
        args.message_filter_failed.is_some(),
        args.block_level_markdown,
        CommunityEventPusher {
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
        display_name.or(args.sender_display_name),
        channel.id,
        channel.chat.name.value.clone(),
        channel.chat.avatar.as_ref().map(|d| d.id),
        args.thread_root_message_index,
        users_mentioned,
        args.new_achievement,
        now,
        state,
    ))
}

fn c2c_send_message_impl(args: C2CArgs, state: &mut RuntimeState) -> OCResult<SuccessResult> {
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
    let display_name = prepare(caller, args.community_rules_accepted, state)?;

    let mut content = args.content;
    // Recorded so the prize can be refunded to the sender's wallet even if they have left
    if let MessageContentInternal::Prize(prize) = &mut content {
        prize.principal = state.member_user(caller.agent()).principal;
    }

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();
        let users_mentioned = extract_users_mentioned(args.mentioned, content.text(), &state.data.members);

        let result = channel.chat.send_message(
            caller,
            args.thread_root_message_index,
            args.message_id,
            content,
            args.replies_to,
            &users_mentioned.all_users_mentioned,
            args.forwarding,
            args.channel_rules_accepted,
            args.message_filter_failed.is_some(),
            args.block_level_markdown,
            CommunityEventPusher {
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
            display_name.or(args.sender_display_name),
            channel.id,
            channel.chat.name.value.clone(),
            channel.chat.avatar.as_ref().map(|d| d.id),
            args.thread_root_message_index,
            users_mentioned,
            new_achievement,
            now,
            state,
        ))
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}

// Checks the community isn't frozen and the sender has accepted its rules, returning their display name
pub(crate) fn prepare(
    caller: &Caller,
    community_rules_accepted: Option<Version>,
    state: &mut RuntimeState,
) -> OCResult<Option<String>> {
    if state.data.is_frozen() {
        return Err(OCErrorCode::CommunityFrozen.into());
    }

    let now = state.env.now();
    let sender = caller.agent();

    if let Some(version) = community_rules_accepted {
        state.data.members.mark_rules_accepted(&sender, version, now);
    }

    if caller.is_bot() {
        return Ok(None);
    }

    if let Some(member) = state.data.members.get_by_user_id(&sender) {
        if state.data.rules.enabled
            && !member.user_type.is_bot()
            && member
                .rules_accepted
                .as_ref()
                .is_none_or(|accepted| accepted.value < state.data.rules.text.version)
        {
            Err(OCErrorCode::CommunityRulesNotAccepted.into())
        } else {
            Ok(member.display_name().value.clone())
        }
    } else {
        Err(OCErrorCode::InitiatorNotInCommunity.into())
    }
}

#[expect(clippy::too_many_arguments)]
fn process_send_message_result(
    result: SendMessageSuccess,
    caller: &Caller,
    sender_username: String,
    sender_display_name: Option<String>,
    channel_id: ChannelId,
    channel_name: String,
    channel_avatar_id: Option<u128>,
    thread_root_message_index: Option<MessageIndex>,
    users_mentioned: UsersMentioned,
    new_achievement: bool,
    now: TimestampMillis,
    state: &mut RuntimeState,
) -> SuccessResult {
    let message_event = &result.message_event;
    let event_index = message_event.index;
    let message_index = message_event.event.message_index;
    let message_id = message_event.event.message_id;
    let expires_at = message_event.expires_at;
    let content = &message_event.event.content;
    let community_id: CommunityId = state.env.canister_id().into();

    register_timer_jobs(channel_id, thread_root_message_index, message_event, now, &mut state.data);

    if state.data.is_public.value && state.data.channels.get(&channel_id).is_some_and(|c| c.chat.is_public.value) {
        let input = message_event.event.content.moderation_input();
        if !input.is_empty() {
            state.queue_message_for_moderation(channel_id, thread_root_message_index, message_id, input);
        }
        // Deliberately a sibling of the classification gate, not nested inside it: `input` is
        // empty for an image with no caption, which is exactly the message media scanning
        // must not skip
        let blobs = message_event.event.content.scannable_blobs();
        if !blobs.is_empty() {
            state.queue_media_for_scanning(channel_id, thread_root_message_index, message_id, blobs);
        }
    }

    if !result.unfinalised_bot_message {
        let sender = caller.agent();
        let message_text =
            content.notification_text(&users_mentioned.mentioned_directly, &users_mentioned.user_groups_mentioned);

        let notification = ChannelUserNotificationPayload::ChannelMessage(ChannelMessageNotification {
            community_id,
            channel_id,
            thread_root_message_index,
            message_index: message_event.event.message_index,
            event_index: message_event.index,
            community_name: state.data.name.value.clone(),
            channel_name,
            sender,
            sender_name: sender_username,
            sender_display_name,
            message_type: content.content_type().to_string(),
            message_text,
            image_url: content.notification_image_url(),
            file_name: content.notification_file_name(),
            community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
            channel_avatar_id,
            crypto_transfer: content.notification_crypto_transfer_details(&users_mentioned.mentioned_directly),
            call: None,
        });
        state.push_notification(Some(sender), result.users_to_notify, notification);

        if new_achievement && !caller.is_bot() {
            for a in result
                .message_event
                .event
                .achievements(false, thread_root_message_index.is_some())
            {
                state.notify_user_of_achievement(sender, a, now);
            }
        }

        let mut activity_events = Vec::new();

        if let MessageContent::Crypto(c) = &message_event.event.content {
            let recipient_is_human = state
                .data
                .members
                .get_by_user_id(&c.recipient)
                .is_some_and(|m| !m.user_type.is_bot());

            if recipient_is_human {
                state.notify_user_of_achievement(c.recipient, Achievement::ReceivedCrypto, now);

                activity_events.push((c.recipient, MessageActivity::Crypto));
            }
        }

        if let Some(channel) = state.data.channels.get(&channel_id) {
            for user_id in users_mentioned.all_users_mentioned {
                if caller.initiator().map(|i| i != user_id).unwrap_or_default()
                    && channel.chat.members.get(&user_id).is_some_and(|m| !m.user_type().is_bot())
                {
                    activity_events.push((user_id, MessageActivity::Mention));
                }
            }

            if let Some(replying_to_event_index) = message_event
                .event
                .replies_to
                .as_ref()
                .filter(|r| r.chat_if_other.is_none())
                .map(|r| r.event_index)
                && let Some((message, _)) = channel.chat.events.message_internal(
                    EventIndex::default(),
                    thread_root_message_index,
                    replying_to_event_index.into(),
                )
                && caller.initiator().map(|i| i != message.sender).unwrap_or_default()
                && channel
                    .chat
                    .members
                    .get(&message.sender)
                    .is_some_and(|m| !m.user_type().is_bot())
            {
                activity_events.push((message.sender, MessageActivity::QuoteReply));
            }
        }

        for (user_id, activity) in activity_events {
            state.push_event_to_user(
                user_id,
                CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
                    chat: Chat::Channel(community_id, channel_id),
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
    channel_id: ChannelId,
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
                        channel_id,
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
                    channel_id,
                    message_index: message_event.event.message_index,
                }),
                p.end_date,
                now,
            );
        }
        MessageContent::P2PSwap(c) => {
            data.timer_jobs.enqueue_job(
                TimerJob::MarkP2PSwapExpired(MarkP2PSwapExpiredJob {
                    channel_id,
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

lazy_static! {
    static ref USER_GROUP_REGEX: Regex = Regex::new(r"@UserGroup\((\d+)\)").unwrap();
}

struct UsersMentioned {
    mentioned_directly: Vec<User>,
    all_users_mentioned: Vec<UserId>,
    user_groups_mentioned: Vec<(u32, String)>,
}

fn extract_users_mentioned(mentioned: Vec<User>, text: Option<&str>, members: &CommunityMembers) -> UsersMentioned {
    let user_groups_mentioned = extract_user_groups_mentioned(text, members);
    let all_users_mentioned = mentioned
        .iter()
        .map(|u| u.user_id)
        .chain(user_groups_mentioned.iter().flat_map(|ug| ug.members.value.iter().copied()))
        .unique()
        .collect();

    UsersMentioned {
        mentioned_directly: mentioned,
        all_users_mentioned,
        user_groups_mentioned: user_groups_mentioned
            .iter()
            .map(|ug| (ug.id, ug.name.value.clone()))
            .collect(),
    }
}

fn extract_user_groups_mentioned<'a>(text: Option<&'a str>, members: &'a CommunityMembers) -> Vec<&'a UserGroup> {
    if let Some(text) = text
        && text.contains("@UserGroup")
    {
        return USER_GROUP_REGEX
            .captures_iter(text)
            .filter_map(|c| c.get(1))
            .filter_map(|m| u32::from_str(m.as_str()).ok())
            .filter_map(|id| members.get_user_group(id))
            .collect();
    }

    Vec::new()
}

// Sends a message holding a transfer the sender makes from their own funds, making the transfer
// first. See `send_message::Args` for which transfers are accepted.
async fn send_message_with_transfer(args: Args) -> OCResult<SuccessResult> {
    let (user_id, prepared) = mutate_state(|state| prepare_transfer(&args, state))?;

    match prepared {
        // The transfer was certified, so the message has been sent already
        PrepareTransferResult::Sent(result) => Ok(result),
        PrepareTransferResult::Icrc2(transfer) => {
            let from = transfer.from;
            let completed: CompletedCryptoTransaction =
                match ledger_utils::icrc2::process_transaction_for_user(transfer, user_id).await {
                    Ok(Ok(completed)) => completed.into(),
                    Ok(Err((_, error))) => return Err(error),
                    Err(error) => return Err(error.into()),
                };

            let (result, now) = mutate_state(|state| {
                (
                    send_message_holding_transfer(user_id, &args, completed.clone(), None, state),
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

            let result = mutate_state(|state| send_message_holding_transfer(user_id, &args, completed, Some(swap_id), state));
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

fn prepare_transfer(args: &Args, state: &mut RuntimeState) -> OCResult<(UserId, PrepareTransferResult)> {
    let caller = state.verified_caller(None)?;
    let Caller::User(user_id) = caller else {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };

    prepare(&caller, args.community_rules_accepted, state)?;

    if state.data.channels.get_or_err(&args.channel_id)?.chat.external_url.is_some() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

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
                // The community holds the prize, paying out each winner's share from its own account
                let recipient = UserIdAndPrincipal::new(this_canister_id.into(), this_canister_id);
                (MessageContentType::Prize, MEMO_PRIZE.as_slice(), p.transfer, recipient)
            }
            ValidateNewMessageContentResult::SuccessP2PSwap(p) => {
                state
                    .data
                    .channels
                    .get_or_err(&args.channel_id)?
                    .chat
                    .check_can_send_message(
                        user_id,
                        args.thread_root_message_index,
                        args.message_id,
                        MessageContentType::P2PSwap,
                        args.channel_rules_accepted,
                    )?;
                let location = P2PSwapLocation::from_message(
                    Chat::Channel(this_canister_id.into(), args.channel_id),
                    args.thread_root_message_index,
                    args.message_id,
                );
                let swap = NewP2PSwap::new(&p, location, state.member_wallet(user_id)?, this_canister_id, now)?;
                return Ok((
                    user_id,
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

    let transfer = MemberTransfer::new(transfer, recipient, memo, this_canister_id)?;

    state
        .data
        .channels
        .get_or_err(&args.channel_id)?
        .chat
        .check_can_send_message(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            content_type,
            args.channel_rules_accepted,
        )?;

    match transfer {
        MemberTransfer::Icrc2(transfer) => Ok((user_id, PrepareTransferResult::Icrc2(transfer))),
        MemberTransfer::Certified(transfer) => {
            let completed = state.data.certified_transfers.verify(
                transfer,
                state.env.caller(),
                memo,
                this_canister_id,
                &state.env.ic_root_key(),
                now,
            )?;
            let result = send_message_holding_transfer(user_id, args, completed.clone().into(), None, state)?;
            state.data.certified_transfers.mark_used(&completed, now);
            Ok((user_id, PrepareTransferResult::Sent(result)))
        }
    }
}

fn send_message_holding_transfer(
    user_id: UserId,
    args: &Args,
    transfer: CompletedCryptoTransaction,
    p2p_swap_id: Option<u32>,
    state: &mut RuntimeState,
) -> OCResult<SuccessResult> {
    let now = state.env.now();
    let content = MessageContentInternal::new_with_transfer(args.content.clone(), transfer.clone().into(), p2p_swap_id, now);

    let c2c_args = C2CArgs {
        channel_id: args.channel_id,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        content,
        sender_name: args.sender_name.clone(),
        sender_display_name: args.sender_display_name.clone(),
        replies_to: args.replies_to.clone(),
        mentioned: args.mentioned.clone(),
        forwarding: false,
        block_level_markdown: args.block_level_markdown,
        og_previews: args.og_previews.clone(),
        community_rules_accepted: args.community_rules_accepted,
        channel_rules_accepted: args.channel_rules_accepted,
        message_filter_failed: args.message_filter_failed,
    };

    let result = send_message_with_completed_transfer(&Caller::User(user_id), c2c_args, args.new_achievement, state)?;

    Ok(SuccessResult {
        transfer: Some(transfer),
        ..result
    })
}
