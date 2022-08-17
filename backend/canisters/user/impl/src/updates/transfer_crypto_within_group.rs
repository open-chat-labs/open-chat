use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::Tokens;
use types::{
    CompletedCryptoTransactionV2, CryptoContent, CryptoTransactionV2, FailedCryptoTransactionV2, MessageContent,
    PendingCryptoTransactionV2, ICP_TRANSFER_LIMIT, MAX_TEXT_LENGTH, MAX_TEXT_LENGTH_USIZE,
};
use user_canister::transfer_crypto_within_group_v2::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn transfer_crypto_within_group_v2(args: Args) -> Response {
    run_regular_jobs();

    if let Err(response) = read_state(|state| validate_request(&args, state)) {
        return response;
    }

    let pending_transaction = match &args.content.transfer {
        CryptoTransactionV2::Pending(t) => t.clone(),
        _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
    };
    if !pending_transaction.is_user_recipient(args.recipient) {
        return InvalidRequest("Transaction is not to the user's account".to_string());
    }

    let completed_transaction = match process_transaction(pending_transaction).await {
        Ok(completed) => completed,
        Err(FailedCryptoTransactionV2::NNS(failed)) => return TransferFailed(failed.error_message),
    };

    let c2c_args = group_canister::send_message::Args {
        message_id: args.message_id,
        thread_root_message_index: None,
        content: MessageContent::Crypto(CryptoContent {
            recipient: args.recipient,
            transfer: CryptoTransactionV2::Completed(completed_transaction.clone()),
            caption: args.content.caption,
        }),
        sender_name: args.sender_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
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

fn validate_request(args: &Args, runtime_state: &RuntimeState) -> Result<(), Response> {
    let amount = match &args.content.transfer {
        CryptoTransactionV2::Pending(PendingCryptoTransactionV2::NNS(t)) => t.amount,
        CryptoTransactionV2::Completed(CompletedCryptoTransactionV2::NNS(t)) => t.amount,
        CryptoTransactionV2::Failed(FailedCryptoTransactionV2::NNS(t)) => t.amount,
    };

    if runtime_state.data.blocked_users.contains(&args.recipient) {
        Err(RecipientBlocked)
    } else if runtime_state.data.group_chats.get(&args.group_id).is_none() {
        Err(CallerNotInGroup(None))
    } else if amount == Tokens::ZERO {
        Err(TransferCannotBeZero)
    } else if amount > ICP_TRANSFER_LIMIT {
        Err(TransferLimitExceeded(ICP_TRANSFER_LIMIT))
    } else if args.content.caption.as_ref().map_or(0, |c| c.len()) > MAX_TEXT_LENGTH_USIZE {
        Err(TextTooLong(MAX_TEXT_LENGTH))
    } else {
        Ok(())
    }
}
