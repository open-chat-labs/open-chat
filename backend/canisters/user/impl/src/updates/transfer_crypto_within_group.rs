use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{CryptoContent, CryptoTransaction, MessageContent, MAX_TEXT_LENGTH, MAX_TEXT_LENGTH_USIZE};
use user_canister::transfer_crypto_within_group_v2::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn transfer_crypto_within_group_v2(args: Args) -> Response {
    run_regular_jobs();

    if let Err(response) = read_state(|state| validate_request(&args, state)) {
        return *response;
    }

    let pending_transaction = match &args.content.transfer {
        CryptoTransaction::Pending(t) => t.clone(),
        _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
    };
    if !pending_transaction.is_user_recipient(args.recipient) {
        return InvalidRequest("Transaction is not to the user's account".to_string());
    }

    let completed_transaction = match process_transaction(pending_transaction).await {
        Ok(completed) => completed,
        Err(failed) => return TransferFailed(failed.error_message().to_string()),
    };

    let c2c_args = group_canister::send_message::Args {
        message_id: args.message_id,
        thread_root_message_index: args.thread_root_message_index,
        content: MessageContent::Crypto(CryptoContent {
            recipient: args.recipient,
            transfer: CryptoTransaction::Completed(completed_transaction.clone()),
            caption: args.content.caption,
        }),
        sender_name: args.sender_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
        correlation_id: args.correlation_id,
    };

    match group_canister_c2c_client::send_message(args.group_id.into(), &c2c_args).await {
        Ok(response) => match response {
            group_canister::send_message::Response::Success(r) => Success(SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                transfer: completed_transaction,
            }),
            group_canister::send_message::Response::CallerNotInGroup => CallerNotInGroup(Some(completed_transaction)),
            group_canister::send_message::Response::ChatFrozen => ChatFrozen,
            group_canister::send_message::Response::MessageEmpty
            | group_canister::send_message::Response::InvalidPoll(_)
            | group_canister::send_message::Response::NotAuthorized
            | group_canister::send_message::Response::ThreadMessageNotFound
            | group_canister::send_message::Response::InvalidRequest(_)
            | group_canister::send_message::Response::TextTooLong(_) => unreachable!(),
        },
        Err(error) => InternalError(format!("{error:?}"), completed_transaction),
    }
}

fn validate_request(args: &Args, runtime_state: &RuntimeState) -> Result<(), Box<Response>> {
    if runtime_state.data.blocked_users.contains(&args.recipient) {
        Err(Box::new(RecipientBlocked))
    } else if runtime_state.data.group_chats.get(&args.group_id).is_none() {
        Err(Box::new(CallerNotInGroup(None)))
    } else if args.content.transfer.is_zero() {
        Err(Box::new(TransferCannotBeZero))
    } else if args.content.transfer.exceeds_transfer_limit() {
        Err(Box::new(TransferLimitExceeded(
            args.content.transfer.token().transfer_limit(),
        )))
    } else if args.content.caption.as_ref().map_or(0, |c| c.len()) > MAX_TEXT_LENGTH_USIZE {
        Err(Box::new(TextTooLong(MAX_TEXT_LENGTH)))
    } else {
        Ok(())
    }
}
