use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::Tokens;
use ledger_utils::default_ledger_account;
use types::{
    nns, CompletedCryptoTransaction, CompletedCryptoTransactionV2, CryptoAccount, CryptoTransaction, CryptoTransactionV2,
    CryptocurrencyContent, MessageContent, PendingCryptoTransaction, PendingCryptoTransactionV2, UserId, ICP_TRANSFER_LIMIT,
    MAX_TEXT_LENGTH, MAX_TEXT_LENGTH_USIZE,
};
use user_canister::transfer_crypto_within_group::{Response::*, *};
use user_canister::transfer_crypto_within_group_v2 as v2;

#[update(guard = "caller_is_owner")]
#[trace]
async fn transfer_crypto_within_group_v2(args: v2::Args) -> v2::Response {
    let my_user_id: UserId = read_state(|state| state.env.canister_id()).into();

    let pending_transaction = match &args.content.transfer {
        CryptoTransactionV2::Pending(PendingCryptoTransactionV2::NNS(t)) => t.clone(),
        _ => return v2::Response::InvalidRequest("Transaction must be of type 'Pending'".to_string()),
    };

    let response = transfer_crypto_within_group(Args {
        message_id: args.message_id,
        group_id: args.group_id,
        recipient: args.recipient,
        content: CryptocurrencyContent {
            transfer: CryptoTransaction::Pending(PendingCryptoTransaction {
                token: pending_transaction.token,
                amount: pending_transaction.amount,
                to: CryptoAccount::User(args.recipient),
                fee: pending_transaction.fee,
                memo: pending_transaction.memo,
            }),
            caption: args.content.caption,
        },
        sender_name: args.sender_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
    })
    .await;

    match response {
        Success(r) => v2::Response::Success(v2::SuccessResult {
            event_index: r.event_index,
            message_index: r.message_index,
            timestamp: r.timestamp,
            transfer: convert_transaction(r.transfer, my_user_id, args.recipient),
        }),
        TextTooLong(l) => v2::Response::TextTooLong(l),
        RecipientBlocked => v2::Response::RecipientBlocked,
        CallerNotInGroup(ct) => v2::Response::CallerNotInGroup(ct.map(|t| convert_transaction(t, my_user_id, args.recipient))),
        CryptocurrencyNotSupported(c) => v2::Response::CryptocurrencyNotSupported(c),
        InvalidRequest(e) => v2::Response::InvalidRequest(e),
        TransferFailed(e) => v2::Response::TransferFailed(e),
        TransferCannotBeZero => v2::Response::TransferCannotBeZero,
        TransferLimitExceeded(l) => v2::Response::TransferLimitExceeded(l),
        InternalError(e, t) => v2::Response::InternalError(e, convert_transaction(t, my_user_id, args.recipient)),
    }
}

#[update(guard = "caller_is_owner")]
#[trace]
async fn transfer_crypto_within_group(args: Args) -> Response {
    run_regular_jobs();

    if let Err(response) = read_state(|state| validate_request(&args, state)) {
        return response;
    }

    let pending_transaction = match &args.content.transfer {
        CryptoTransaction::Pending(t) => t.clone(),
        _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
    };

    let completed_transaction = match process_transaction(pending_transaction).await {
        Ok(completed) => completed,
        Err(failed) => return TransferFailed(failed.error_message),
    };

    let c2c_args = group_canister::send_message::Args {
        message_id: args.message_id,
        thread_root_message_index: None,
        content: MessageContent::Cryptocurrency(CryptocurrencyContent {
            transfer: CryptoTransaction::Completed(completed_transaction.clone()),
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
    if runtime_state.data.blocked_users.contains(&args.recipient) {
        Err(RecipientBlocked)
    } else if runtime_state.data.group_chats.get(&args.group_id).is_none() {
        Err(CallerNotInGroup(None))
    } else if args.content.transfer.amount() == Tokens::ZERO {
        Err(TransferCannotBeZero)
    } else if args.content.transfer.amount() > ICP_TRANSFER_LIMIT {
        Err(TransferLimitExceeded(ICP_TRANSFER_LIMIT))
    } else if args.content.caption.as_ref().map_or(0, |c| c.len()) > MAX_TEXT_LENGTH_USIZE {
        Err(TextTooLong(MAX_TEXT_LENGTH))
    } else {
        Ok(())
    }
}

fn convert_transaction(
    transaction: CompletedCryptoTransaction,
    my_user_id: UserId,
    recipient: UserId,
) -> CompletedCryptoTransactionV2 {
    CompletedCryptoTransactionV2::NNS(nns::CompletedCryptoTransaction {
        token: transaction.token,
        amount: transaction.amount,
        fee: transaction.fee,
        from: nns::CryptoAccount::Account(default_ledger_account(my_user_id.into())),
        to: nns::CryptoAccount::Account(default_ledger_account(recipient.into())),
        memo: transaction.memo,
        created: transaction.created,
        transaction_hash: transaction.transaction_hash,
        block_index: transaction.block_index,
    })
}
