use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{
    CryptoContent, CryptoTransaction, MessageContentInitial, PendingCryptoTransaction, PrizeContentInitial, MAX_TEXT_LENGTH,
    MAX_TEXT_LENGTH_USIZE,
};
use user_canister::send_message_with_transfer_to_group::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn transfer_crypto_within_group_v2(
    args: user_canister::transfer_crypto_within_group_v2::Args,
) -> user_canister::transfer_crypto_within_group_v2::Response {
    send_message_with_transfer_to_group_impl(args.into()).await
}

#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message_with_transfer_to_group(args: Args) -> Response {
    send_message_with_transfer_to_group_impl(args).await
}

async fn send_message_with_transfer_to_group_impl(args: Args) -> Response {
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
            group_canister::send_message::Response::Success(r) => Success(SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                expires_at: r.expires_at,
                transfer: completed_transaction,
            }),
            group_canister::send_message::Response::CallerNotInGroup => CallerNotInGroup(Some(completed_transaction)),
            group_canister::send_message::Response::UserSuspended => UserSuspended,
            group_canister::send_message::Response::ChatFrozen => ChatFrozen,
            group_canister::send_message::Response::MessageEmpty
            | group_canister::send_message::Response::InvalidPoll(_)
            | group_canister::send_message::Response::NotAuthorized
            | group_canister::send_message::Response::ThreadMessageNotFound
            | group_canister::send_message::Response::InvalidRequest(_)
            | group_canister::send_message::Response::TextTooLong(_) => unreachable!(),
        },
        // TODO: We should retry sending the message
        Err(error) => InternalError(format!("{error:?}"), completed_transaction),
    }
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PendingCryptoTransaction, Box<Response>> {
    let now = runtime_state.env.now();

    if runtime_state.data.suspended.value {
        return Err(Box::new(UserSuspended));
    } else if runtime_state.data.group_chats.get(&args.group_id).is_none() {
        return Err(Box::new(CallerNotInGroup(None)));
    } else if args.content.text_length() > MAX_TEXT_LENGTH_USIZE {
        return Err(Box::new(TextTooLong(MAX_TEXT_LENGTH)));
    }

    let pending_transaction = match &args.content {
        MessageContentInitial::Crypto(c) => {
            if runtime_state.data.blocked_users.contains(&c.recipient) {
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

    let amount = pending_transaction.units();
    let limit = pending_transaction.token().transfer_limit();

    if amount == 0 {
        return Err(Box::new(TransferCannotBeZero));
    } else if amount > limit {
        return Err(Box::new(TransferLimitExceeded(limit)));
    }

    Ok(pending_transaction)
}
