use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::MessageContentInternal;
use ic_cdk_macros::update;
use types::{CryptoTransaction, MessageContentInitial, PendingCryptoTransaction, MAX_TEXT_LENGTH, MAX_TEXT_LENGTH_USIZE};
use user_canister::send_message_with_transfer_to_channel;
use user_canister::send_message_with_transfer_to_group;
use utils::consts::{MEMO_MESSAGE, MEMO_PRIZE};

#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message_with_transfer_to_channel(
    args: send_message_with_transfer_to_channel::Args,
) -> send_message_with_transfer_to_channel::Response {
    use send_message_with_transfer_to_channel::Response::*;

    run_regular_jobs();

    // Check that the user is a member of the community
    if read_state(|state| !state.data.communities.exists(&args.community_id)) {
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
        PrepareResult::TransferCannotBeToSelf => return TransferCannotBeToSelf,
    };

    // Make the crypto transfer
    let completed_transaction = match process_transaction(pending_transaction).await {
        Ok(completed) => completed,
        Err(failed) => return TransferFailed(failed.error_message().to_string()),
    };

    // Mutate the content so it now includes the completed transaction
    let content = MessageContentInternal::new_with_transfer(args.content, completed_transaction.clone());

    // Build the send_message args
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
        community_rules_accepted: args.community_rules_accepted,
        channel_rules_accepted: args.channel_rules_accepted,
        message_filter_failed: args.message_filter_failed,
    };

    // Send the message to the community
    use community_canister::c2c_send_message::Response;
    match community_canister_c2c_client::c2c_send_message(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            Response::Success(r) => Success(send_message_with_transfer_to_channel::SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                expires_at: r.expires_at,
                transfer: completed_transaction,
            }),
            Response::UserNotInCommunity => UserNotInCommunity(Some(completed_transaction)),
            Response::UserNotInChannel => UserNotInChannel(completed_transaction),
            Response::ChannelNotFound => ChannelNotFound(completed_transaction),
            Response::UserSuspended => UserSuspended,
            Response::CommunityFrozen => CommunityFrozen,
            Response::RulesNotAccepted => RulesNotAccepted,
            Response::CommunityRulesNotAccepted => CommunityRulesNotAccepted,
            Response::MessageEmpty
            | Response::InvalidPoll(_)
            | Response::NotAuthorized
            | Response::ThreadMessageNotFound
            | Response::InvalidRequest(_)
            | Response::TextTooLong(_) => unreachable!(),
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
    if read_state(|state| !state.data.group_chats.exists(&args.group_id)) {
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
        PrepareResult::TransferCannotBeToSelf => return TransferCannotBeToSelf,
    };

    // Make the crypto transfer
    let completed_transaction = match process_transaction(pending_transaction).await {
        Ok(completed) => completed,
        Err(failed) => return TransferFailed(failed.error_message().to_string()),
    };

    // Mutate the content so it now includes the completed transaction
    let content = MessageContentInternal::new_with_transfer(args.content, completed_transaction.clone());

    // Build the send_message args
    let c2c_args = group_canister::c2c_send_message::Args {
        message_id: args.message_id,
        thread_root_message_index: args.thread_root_message_index,
        content,
        sender_name: args.sender_name,
        sender_display_name: args.sender_display_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
        rules_accepted: args.rules_accepted,
        message_filter_failed: args.message_filter_failed,
        correlation_id: args.correlation_id,
    };

    // Send the message to the group
    use group_canister::c2c_send_message::Response;
    match group_canister_c2c_client::c2c_send_message(args.group_id.into(), &c2c_args).await {
        Ok(response) => match response {
            Response::Success(r) => Success(send_message_with_transfer_to_group::SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                expires_at: r.expires_at,
                transfer: completed_transaction,
            }),
            Response::CallerNotInGroup => CallerNotInGroup(Some(completed_transaction)),
            Response::UserSuspended => UserSuspended,
            Response::ChatFrozen => ChatFrozen,
            Response::RulesNotAccepted => RulesNotAccepted,
            Response::MessageEmpty
            | Response::InvalidPoll(_)
            | Response::NotAuthorized
            | Response::ThreadMessageNotFound
            | Response::InvalidRequest(_)
            | Response::TextTooLong(_) => unreachable!(),
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
    TransferCannotBeToSelf,
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
            let my_user_id = state.env.canister_id().into();
            if c.recipient == my_user_id {
                return TransferCannotBeToSelf;
            }
            if state.data.blocked_users.contains(&c.recipient) {
                return RecipientBlocked;
            }
            match &c.transfer {
                CryptoTransaction::Pending(t) => t.clone().set_memo(&MEMO_MESSAGE),
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
                    let prize_fees = c.prizes.len() as u128 * t.fee();
                    let total_amount_to_send = total_prize + prize_fees;

                    if t.units() != total_amount_to_send {
                        return InvalidRequest("Transaction amount must equal total prize + prize fees".to_string());
                    }

                    t.clone().set_memo(&MEMO_PRIZE)
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
