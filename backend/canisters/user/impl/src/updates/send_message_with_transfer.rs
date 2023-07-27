use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::send_message;
use group_canister::send_message_v2;
use ic_cdk_macros::update;
use types::{
    CompletedCryptoTransaction, CryptoContent, CryptoTransaction, MessageContentInitial, PendingCryptoTransaction,
    PrizeContentInitial, MAX_TEXT_LENGTH, MAX_TEXT_LENGTH_USIZE,
};
use user_canister::send_message_with_transfer_to_channel;
use user_canister::send_message_with_transfer_to_group;

#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message_with_transfer_to_channel(
    args: send_message_with_transfer_to_channel::Args,
) -> send_message_with_transfer_to_channel::Response {
    use send_message_with_transfer_to_channel::Response::*;

    run_regular_jobs();

    // Check that the user is a member of the community
    if read_state(|state| state.data.communities.get(&args.community_id).is_none()) {
        return UserNotInCommunity(None);
    }

    // Validate the content and extract the PendingCryptoTransaction
    let pending_transaction = match read_state(|state| prepare(&args.content, state)) {
        PrepareResult::Success(t) => t,
        PrepareResult::UserSuspended => return UserSuspended,
        PrepareResult::TextTooLong(v) => return TextTooLong(v),
        PrepareResult::RecipientBlocked => return RecipientBlocked,
        PrepareResult::InvalidRequest(t) => return InvalidRequest(t),
        PrepareResult::TransferCannotBeZero => return TransferCannotBeZero,
    };

    // Make the crypto transfer
    let completed_transaction = match process_transaction(pending_transaction).await {
        Ok(completed) => completed,
        Err(failed) => return TransferFailed(failed.error_message().to_string()),
    };

    // Mutate the content so it now includes the completed transaction
    let content = transform_content_with_completed_transaction(args.content, completed_transaction.clone());

    // Build the send_message args
    let c2c_args = community_canister::send_message::Args {
        channel_id: args.channel_id,
        message_id: args.message_id,
        thread_root_message_index: args.thread_root_message_index,
        content,
        sender_name: args.sender_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
    };

    // Send the message to the community
    match community_canister_c2c_client::send_message(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            send_message::Response::Success(r) => Success(send_message_with_transfer_to_channel::SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                expires_at: r.expires_at,
                transfer: completed_transaction,
            }),
            send_message::Response::UserNotInCommunity => UserNotInCommunity(Some(completed_transaction)),
            send_message::Response::UserNotInChannel => UserNotInChannel(completed_transaction),
            send_message::Response::ChannelNotFound => ChannelNotFound(completed_transaction),
            send_message::Response::UserSuspended => UserSuspended,
            send_message::Response::CommunityFrozen => CommunityFrozen,
            send_message::Response::MessageEmpty
            | send_message::Response::InvalidPoll(_)
            | send_message::Response::NotAuthorized
            | send_message::Response::ThreadMessageNotFound
            | send_message::Response::InvalidRequest(_)
            | send_message::Response::TextTooLong(_) => unreachable!(),
        },
        // TODO: We should retry sending the message
        Err(error) => InternalError(format!("{error:?}"), completed_transaction),
    }
}

#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message_with_transfer_to_group(
    args: send_message_with_transfer_to_group::Args,
) -> send_message_with_transfer_to_group::Response {
    use send_message_with_transfer_to_group::Response::*;

    run_regular_jobs();

    // Check that the user is a member of the group
    if read_state(|state| state.data.group_chats.get(&args.group_id).is_none()) {
        return CallerNotInGroup(None);
    }

    // Validate the content and extract the PendingCryptoTransaction
    let pending_transaction = match read_state(|state| prepare(&args.content, state)) {
        PrepareResult::Success(t) => t,
        PrepareResult::UserSuspended => return UserSuspended,
        PrepareResult::TextTooLong(v) => return TextTooLong(v),
        PrepareResult::RecipientBlocked => return RecipientBlocked,
        PrepareResult::InvalidRequest(t) => return InvalidRequest(t),
        PrepareResult::TransferCannotBeZero => return TransferCannotBeZero,
    };

    // Make the crypto transfer
    let completed_transaction = match process_transaction(pending_transaction).await {
        Ok(completed) => completed,
        Err(failed) => return TransferFailed(failed.error_message().to_string()),
    };

    // Mutate the content so it now includes the completed transaction
    let content = transform_content_with_completed_transaction(args.content, completed_transaction.clone());

    // Build the send_message args
    let c2c_args = group_canister::send_message_v2::Args {
        message_id: args.message_id,
        thread_root_message_index: args.thread_root_message_index,
        content,
        sender_name: args.sender_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
        correlation_id: args.correlation_id,
    };

    // Send the message to the group
    match group_canister_c2c_client::send_message_v2(args.group_id.into(), &c2c_args).await {
        Ok(response) => match response {
            send_message_v2::Response::Success(r) => Success(send_message_with_transfer_to_group::SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                expires_at: r.expires_at,
                transfer: completed_transaction,
            }),
            send_message_v2::Response::CallerNotInGroup => CallerNotInGroup(Some(completed_transaction)),
            send_message_v2::Response::UserSuspended => UserSuspended,
            send_message_v2::Response::ChatFrozen => ChatFrozen,
            send_message_v2::Response::MessageEmpty
            | send_message_v2::Response::InvalidPoll(_)
            | send_message_v2::Response::NotAuthorized
            | send_message_v2::Response::ThreadMessageNotFound
            | send_message_v2::Response::InvalidRequest(_)
            | send_message_v2::Response::TextTooLong(_) => unreachable!(),
        },
        // TODO: We should retry sending the message
        Err(error) => InternalError(format!("{error:?}"), completed_transaction),
    }
}

enum PrepareResult {
    Success(PendingCryptoTransaction),
    UserSuspended,
    TextTooLong(u32),
    RecipientBlocked,
    InvalidRequest(String),
    TransferCannotBeZero,
}

fn prepare(content: &MessageContentInitial, state: &RuntimeState) -> PrepareResult {
    use PrepareResult::*;

    let now = state.env.now();

    if state.data.suspended.value {
        return UserSuspended;
    } else if content.text_length() > MAX_TEXT_LENGTH_USIZE {
        return TextTooLong(MAX_TEXT_LENGTH);
    }

    let pending_transaction = match &content {
        MessageContentInitial::Crypto(c) => {
            if state.data.blocked_users.contains(&c.recipient) {
                return RecipientBlocked;
            }
            match &c.transfer {
                CryptoTransaction::Pending(t) => t.clone(),
                _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
            }
        }
        MessageContentInitial::Prize(c) => {
            if c.end_date <= now {
                return InvalidRequest("Prize end date must be in the future".to_string());
            }
            match &c.transfer {
                CryptoTransaction::Pending(t) => {
                    let total_prize = c.prizes.iter().map(|t| t.e8s()).sum::<u64>() as u128;
                    let prize_fees = c.prizes.len() as u128 * t.token().fee().unwrap();
                    let total_amount_to_send = total_prize + prize_fees;

                    if t.units() != total_amount_to_send {
                        return InvalidRequest("Transaction amount must equal total prize + prize fees".to_string());
                    }

                    t.clone()
                }
                _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
            }
        }
        _ => return InvalidRequest("Message must include a crypto transfer".to_string()),
    };

    if !pending_transaction.is_zero() {
        Success(pending_transaction)
    } else {
        TransferCannotBeZero
    }
}

fn transform_content_with_completed_transaction(
    content: MessageContentInitial,
    completed_transaction: CompletedCryptoTransaction,
) -> MessageContentInitial {
    // Mutate the content so it now includes the completed transaction
    match content {
        MessageContentInitial::Crypto(c) => MessageContentInitial::Crypto(CryptoContent {
            recipient: c.recipient,
            transfer: CryptoTransaction::Completed(completed_transaction),
            caption: c.caption,
        }),
        MessageContentInitial::Prize(c) => MessageContentInitial::Prize(PrizeContentInitial {
            prizes: c.prizes,
            transfer: CryptoTransaction::Completed(completed_transaction),
            end_date: c.end_date,
            caption: c.caption,
        }),
        _ => unreachable!("Message must include a crypto transfer"),
    }
}
