use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::send_message;
use ic_cdk_macros::update;
use types::{
    CryptoContent, CryptoTransaction, MessageContentInitial, PendingCryptoTransaction, PrizeContentInitial, MAX_TEXT_LENGTH,
    MAX_TEXT_LENGTH_USIZE,
};
use user_canister::send_message_with_transfer_to_channel::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message_with_transfer_to_channel(args: Args) -> Response {
    send_message_with_transfer_to_channel_impl(args).await
}

async fn send_message_with_transfer_to_channel_impl(args: Args) -> Response {
    run_regular_jobs();

    // Validate the request and extract the PendingCryptoTransaction
    let pending_transaction = match read_state(|state| prepare(&args, state)) {
        Ok(t) => t,
        Err(response) => return *response,
    };

    // Make the crypto transfer
    let completed_transaction = match process_transaction(pending_transaction).await {
        Ok(completed) => completed,
        Err(failed) => return TransferFailed(failed.error_message().to_string()),
    };

    // Mutate the content so it now includes the completed transaction
    let content = match args.content {
        MessageContentInitial::Crypto(c) => MessageContentInitial::Crypto(CryptoContent {
            recipient: c.recipient,
            transfer: CryptoTransaction::Completed(completed_transaction.clone()),
            caption: c.caption,
        }),
        MessageContentInitial::Prize(c) => MessageContentInitial::Prize(PrizeContentInitial {
            prizes: c.prizes,
            transfer: CryptoTransaction::Completed(completed_transaction.clone()),
            end_date: c.end_date,
            caption: c.caption,
        }),
        _ => unreachable!("Message must include a crypto transfer"),
    };

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
            send_message::Response::Success(r) => Success(SuccessResult {
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

fn prepare(args: &Args, state: &RuntimeState) -> Result<PendingCryptoTransaction, Box<Response>> {
    let now = state.env.now();

    if state.data.suspended.value {
        return Err(Box::new(UserSuspended));
    } else if state.data.communities.get(&args.community_id).is_none() {
        return Err(Box::new(UserNotInCommunity(None)));
    } else if args.content.text_length() > MAX_TEXT_LENGTH_USIZE {
        return Err(Box::new(TextTooLong(MAX_TEXT_LENGTH)));
    }

    let pending_transaction = match &args.content {
        MessageContentInitial::Crypto(c) => {
            if state.data.blocked_users.contains(&c.recipient) {
                return Err(Box::new(RecipientBlocked));
            }
            match &c.transfer {
                CryptoTransaction::Pending(t) => t.clone(),
                _ => return Err(Box::new(InvalidRequest("Transaction must be of type 'Pending'".to_string()))),
            }
        }
        MessageContentInitial::Prize(c) => {
            if c.end_date <= now {
                return Err(Box::new(InvalidRequest("Prize end date must be in the future".to_string())));
            }
            match &c.transfer {
                CryptoTransaction::Pending(t) => {
                    let total_prize = c.prizes.iter().map(|t| t.e8s()).sum::<u64>() as u128;
                    let prize_fees = c.prizes.len() as u128 * t.token().fee();
                    let total_amount_to_send = total_prize + prize_fees;

                    if t.units() != total_amount_to_send {
                        return Err(Box::new(InvalidRequest(
                            "Transaction amount must equal total prize + prize fees".to_string(),
                        )));
                    }

                    t.clone()
                }
                _ => return Err(Box::new(InvalidRequest("Transaction must be of type 'Pending'".to_string()))),
            }
        }
        _ => return Err(Box::new(InvalidRequest("Message must include a crypto transfer".to_string()))),
    };

    if pending_transaction.units() > 0 {
        Ok(pending_transaction)
    } else {
        Err(Box::new(TransferCannotBeZero))
    }
}
