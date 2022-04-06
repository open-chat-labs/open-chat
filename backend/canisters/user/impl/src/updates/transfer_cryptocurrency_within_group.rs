use crate::guards::caller_is_owner;
use crate::updates::crypto::{process_transfer, TransferError};
use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::{
    CompletedCryptocurrencyTransfer, Cryptocurrency, CryptocurrencyContent, MessageContent, MAX_TEXT_LENGTH,
    MAX_TEXT_LENGTH_USIZE,
};
use user_canister::transfer_cryptocurrency_within_group::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn transfer_cryptocurrency_within_group(args: Args) -> Response {
    run_regular_jobs();

    if let Err(response) = read_state(|state| validate_request(&args, state)) {
        return response;
    }

    let transfer_details = match process_transfer(args.content.transfer, args.recipient).await {
        Ok(transfer) => transfer,
        Err(error) => {
            return match error {
                TransferError::InvalidRequest(reason) => InvalidRequest(reason),
                TransferError::TransferFailed(reason) => TransferFailed(reason),
            }
        }
    };

    let c2c_args = group_canister::send_message::Args {
        message_id: args.message_id,
        content: MessageContent::Cryptocurrency(CryptocurrencyContent {
            transfer: transfer_details.clone().into(),
            caption: args.content.caption,
        }),
        sender_name: args.sender_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
    };

    let completed_transfer: CompletedCryptocurrencyTransfer = transfer_details.into();

    match group_canister_c2c_client::send_message(args.group_id.into(), &c2c_args).await {
        Ok(response) => match response {
            group_canister::send_message::Response::Success(r) => Success(SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                transfer: completed_transfer,
            }),
            group_canister::send_message::Response::CallerNotInGroup => CallerNotInGroup(Some(completed_transfer)),
            group_canister::send_message::Response::MessageEmpty
            | group_canister::send_message::Response::InvalidPoll(_)
            | group_canister::send_message::Response::NotAuthorized
            | group_canister::send_message::Response::TextTooLong(_) => unreachable!(),
        },
        Err(error) => InternalError(format!("{error:?}"), completed_transfer),
    }
}

fn validate_request(args: &Args, runtime_state: &RuntimeState) -> Result<(), Response> {
    if runtime_state.data.blocked_users.contains(&args.recipient) {
        Err(RecipientBlocked)
    } else if runtime_state.data.group_chats.get(&args.group_id).is_none() {
        Err(CallerNotInGroup(None))
    } else if matches!(args.content.transfer.cryptocurrency(), Cryptocurrency::Cycles) {
        Err(CryptocurrencyNotSupported(Cryptocurrency::Cycles))
    } else if args.content.transfer.is_zero() {
        Err(TransferCannotBeZero)
    } else if let Err(limit) = args.content.within_limit() {
        Err(TransferLimitExceeded(limit))
    } else if args.content.caption.as_ref().map_or(0, |c| c.len()) > MAX_TEXT_LENGTH_USIZE {
        Err(TextTooLong(MAX_TEXT_LENGTH))
    } else {
        Ok(())
    }
}
