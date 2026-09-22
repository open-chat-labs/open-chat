use crate::crypto::process_transaction;
use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::{SendMessageToChannelJob, SendMessageToGroupJob, TimerJob};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::MessageContentInternal;
use constants::SECOND_IN_MS;
use oc_error_codes::{OCError, OCErrorCode};
use types::{
    Achievement, Chat, CompletedCryptoTransaction, MessageContentInitial, MessageId, MessageIndex, OCResult,
    PendingCryptoTransaction, PinNumberWrapper, TimestampMillis, UserId,
};
use user_canister::{send_message_with_transfer_to_channel, send_message_with_transfer_to_group};
use user_core::User;
use user_core::updates::send_message_with_transfer::Prepared;

// As in the User canister, the transfer is made from the user's account (one of this canister's
// subaccounts) before the message is sent to the community, which is told which user is sending

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn send_message_with_transfer_to_channel(
    mut args: send_message_with_transfer_to_channel::Args,
) -> send_message_with_transfer_to_channel::Response {
    use send_message_with_transfer_to_channel::Response::*;

    let community_id = args.community_id;
    let chat = Chat::Channel(community_id, args.channel_id);
    let PrepareOk {
        my_index,
        my_user_id,
        pending_transaction,
        now,
    } = match mutate_state(|state| {
        prepare(
            chat,
            args.thread_root_message_index,
            args.message_id,
            &args.content,
            args.pin.take(),
            |user| user.communities.exists(&community_id),
            state,
        )
    }) {
        Ok(ok) => ok,
        Err(PrepareError::NotAMember) => return UserNotInCommunity(None),
        Err(PrepareError::Error(error)) => return Error(error),
    };

    let (content, transfer) = match make_transfer(args.content, pending_transaction, my_user_id, now).await {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let achievement = content.content_type().achievement();
    let has_thread = args.thread_root_message_index.is_some();
    let quote_reply = args.replies_to.is_some();

    let c2c_args = community_canister::c2c_send_message::Args {
        channel_id: args.channel_id,
        message_id: args.message_id,
        thread_root_message_index: args.thread_root_message_index,
        content,
        sender_name: args.sender_name,
        sender_display_name: args.sender_display_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
        block_level_markdown: args.block_level_markdown,
        community_rules_accepted: args.community_rules_accepted,
        channel_rules_accepted: args.channel_rules_accepted,
        message_filter_failed: args.message_filter_failed,
        og_previews: args.og_previews,
        sender: Some(my_user_id),
    };

    use community_canister::c2c_send_message::Response;
    match community_canister_c2c_client::c2c_send_message(community_id.into(), &c2c_args).await {
        Ok(Response::Success(r)) => {
            mutate_state(|state| award_achievements(my_index, achievement, r.message_index, has_thread, quote_reply, state));
            Success(send_message_with_transfer_to_channel::SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                expires_at: r.expires_at,
                transfer,
            })
        }
        Ok(Response::Error(error)) => Error(error),
        Err(error) => {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.timer_jobs.enqueue_job(
                    TimerJob::SendMessageToChannel(Box::new(SendMessageToChannelJob {
                        user_index: my_index,
                        community_id,
                        args: c2c_args,
                        attempt: 0,
                    })),
                    now + 10 * SECOND_IN_MS,
                    now,
                );
            });
            Retrying(format!("{error:?}"), transfer)
        }
    }
}

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn send_message_with_transfer_to_group(
    mut args: send_message_with_transfer_to_group::Args,
) -> send_message_with_transfer_to_group::Response {
    use send_message_with_transfer_to_group::Response::*;

    let group_id = args.group_id;
    let chat = Chat::Group(group_id);
    let PrepareOk {
        my_index,
        my_user_id,
        pending_transaction,
        now,
    } = match mutate_state(|state| {
        prepare(
            chat,
            args.thread_root_message_index,
            args.message_id,
            &args.content,
            args.pin.take(),
            |user| user.group_chats.exists(&group_id),
            state,
        )
    }) {
        Ok(ok) => ok,
        Err(PrepareError::NotAMember) => return CallerNotInGroup(None),
        Err(PrepareError::Error(error)) => return Error(error),
    };

    let (content, transfer) = match make_transfer(args.content, pending_transaction, my_user_id, now).await {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let achievement = content.content_type().achievement();
    let has_thread = args.thread_root_message_index.is_some();
    let quote_reply = args.replies_to.is_some();

    let c2c_args = group_canister::c2c_send_message::Args {
        message_id: args.message_id,
        thread_root_message_index: args.thread_root_message_index,
        content,
        sender_name: args.sender_name,
        sender_display_name: args.sender_display_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
        block_level_markdown: args.block_level_markdown,
        rules_accepted: args.rules_accepted,
        message_filter_failed: args.message_filter_failed,
        og_previews: args.og_previews,
        sender: Some(my_user_id),
    };

    use group_canister::c2c_send_message::Response;
    match group_canister_c2c_client::c2c_send_message(group_id.into(), &c2c_args).await {
        Ok(Response::Success(r)) => {
            mutate_state(|state| award_achievements(my_index, achievement, r.message_index, has_thread, quote_reply, state));
            Success(send_message_with_transfer_to_group::SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                expires_at: r.expires_at,
                transfer,
            })
        }
        Ok(Response::Error(error)) => Error(error),
        Err(error) => {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.timer_jobs.enqueue_job(
                    TimerJob::SendMessageToGroup(Box::new(SendMessageToGroupJob {
                        user_index: my_index,
                        chat_id: group_id,
                        args: c2c_args,
                        attempt: 0,
                    })),
                    now + 10 * SECOND_IN_MS,
                    now,
                );
            });
            Retrying(format!("{error:?}"), transfer)
        }
    }
}

struct PrepareOk {
    my_index: u16,
    my_user_id: UserId,
    pending_transaction: PendingCryptoTransaction,
    now: TimestampMillis,
}

enum PrepareError {
    // Reported by the endpoint's own response variant, as in the User canister
    NotAMember,
    Error(OCError),
}

fn prepare(
    chat: Chat,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    content: &MessageContentInitial,
    pin: Option<PinNumberWrapper>,
    is_member: impl FnOnce(&User) -> bool,
    state: &mut RuntimeState,
) -> Result<PrepareOk, PrepareError> {
    let canister_id = state.env.canister_id();
    let now = state.env.now();
    state.with_caller_user_mut(|my_index, user| {
        if !is_member(user) {
            return Err(PrepareError::NotAMember);
        }
        let my_user_id = UserId::new_indexed(canister_id, my_index);
        match user_core::updates::send_message_with_transfer::prepare(
            user,
            my_user_id,
            chat,
            thread_root_message_index,
            message_id,
            content,
            pin,
            now,
        ) {
            Ok(Prepared::Transfer(pending_transaction)) => Ok(PrepareOk {
                my_index,
                my_user_id,
                pending_transaction,
                now,
            }),
            // TODO: Set up the swap with the escrow canister, as the User canister does
            Ok(Prepared::P2PSwap(..)) => Err(PrepareError::Error(
                OCErrorCode::InvalidRequest.with_message("P2P swaps are not yet supported by the MultiUser canister"),
            )),
            Err(error) => Err(PrepareError::Error(error)),
        }
    })
}

// Makes the transfer from the user's account, returning the content with the completed transfer in
// place of the pending one
async fn make_transfer(
    content: MessageContentInitial,
    pending_transaction: PendingCryptoTransaction,
    my_user_id: UserId,
    now: TimestampMillis,
) -> OCResult<(MessageContentInternal, CompletedCryptoTransaction)> {
    match process_transaction(pending_transaction, my_user_id).await {
        Ok(Ok(completed)) => Ok((
            MessageContentInternal::new_with_transfer(content, completed.clone().into(), None, now),
            completed,
        )),
        Ok(Err((_, error))) => Err(error),
        Err(error) => Err(error.into()),
    }
}

fn award_achievements(
    my_index: u16,
    message_type_achievement: Option<Achievement>,
    message_index: MessageIndex,
    in_thread: bool,
    quote_reply: bool,
    state: &mut RuntimeState,
) {
    let achievements = user_core::updates::send_message_with_transfer::achievements(
        message_type_achievement,
        message_index,
        in_thread,
        quote_reply,
    );
    state.award_achievements_and_notify(my_index, achievements, state.env.now());
}
