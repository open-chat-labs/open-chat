use super::crypto::cycles::{handle_failed_cycles_transfer, handle_successful_cycles_transfer, CyclesTransferDetails};
use crate::guards::caller_is_owner;
use crate::updates::crypto::{process_transfer, CompletedTransferDetails, TransferError};
use crate::updates::send_message_common::register_callbacks_if_required;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::PushMessageArgs;
use ic_cdk_macros::update;
use tracing::error;
use types::{CanisterId, ContentValidationError, FailedCyclesTransfer, MessageContent, UserId};
use user_canister::c2c_send_message;
use user_canister::c2c_send_message::C2CReplyContext;
use user_canister::send_message::{Response::*, *};

// The args are mutable because if the request contains a pending transfer, we process the transfer
// and then update the message content to contain the completed transfer.
#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message(mut args: Args) -> Response {
    run_regular_jobs();

    if let Err(response) = read_state(|state| validate_request(&args, state)) {
        return response;
    }

    let mut transfer_details = None;
    // If the message includes a pending cryptocurrency transfer, we process that and then update
    // the message to contain the completed transfer.
    if let MessageContent::Cryptocurrency(c) = &mut args.content {
        transfer_details = match process_transfer(c.transfer.clone(), args.recipient).await {
            Ok(transfer) => {
                c.transfer = transfer.clone().into();
                Some(transfer)
            }
            Err(error) => {
                return match error {
                    TransferError::InvalidRequest(reason) => InvalidRequest(reason),
                    TransferError::TransferFailed(reason) => TransferFailed(reason),
                }
            }
        };
    }

    mutate_state(|state| send_message_impl(args, transfer_details, state))
}

fn validate_request(args: &Args, runtime_state: &RuntimeState) -> Result<(), Response> {
    if runtime_state.data.blocked_users.contains(&args.recipient) {
        return Err(RecipientBlocked);
    }

    let now = runtime_state.env.now();

    if let Err(error) = args.content.validate_for_new_message(now) {
        Err(match error {
            ContentValidationError::Empty => MessageEmpty,
            ContentValidationError::TextTooLong(max_length) => TextTooLong(max_length),
            ContentValidationError::InvalidPoll(reason) => InvalidPoll(reason),
            ContentValidationError::TransferCannotBeZero => TransferCannotBeZero,
            ContentValidationError::TransferLimitExceeded(limit) => TransferLimitExceeded(limit),
        })
    } else {
        Ok(())
    }
}

fn send_message_impl(
    args: Args,
    transfer_details: Option<CompletedTransferDetails>,
    runtime_state: &mut RuntimeState,
) -> Response {
    let now = runtime_state.env.now();
    let my_user_id = runtime_state.env.canister_id().into();
    let recipient = args.recipient;

    let push_message_args = PushMessageArgs {
        message_id: args.message_id,
        sender: my_user_id,
        content: args.content.clone().new_content_into_internal(),
        replies_to: args.replies_to.clone(),
        now,
    };

    let message_event = runtime_state
        .data
        .direct_chats
        .push_message(true, recipient, None, push_message_args);

    register_callbacks_if_required(recipient, &message_event, runtime_state);

    let cycles_transfer =
        transfer_details
            .clone()
            .and_then(|t| if let CompletedTransferDetails::Cycles(c) = t { Some(c) } else { None });

    let c2c_args = c2c_send_message::Args {
        message_id: args.message_id,
        sender_name: args.sender_name,
        sender_message_index: message_event.event.message_index,
        content: args.content,
        replies_to: args.replies_to.clone(),
        replies_to_v2: args.replies_to.and_then(|r| {
            if let Some(chat_id) = r.chat_id_if_other {
                Some(C2CReplyContext::OtherChat(chat_id, r.event_index))
            } else {
                runtime_state
                    .data
                    .direct_chats
                    .get(&args.recipient.into())
                    .and_then(|chat| chat.events.get_message_id_by_event_index(r.event_index))
                    .map(C2CReplyContext::ThisChat)
            }
        }),
    };
    ic_cdk::spawn(send_to_recipients_canister(recipient, c2c_args, cycles_transfer, false));

    if let Some(transfer) = transfer_details.map(|t| t.into()) {
        TransferSuccess(TransferSuccessResult {
            chat_id: recipient.into(),
            event_index: message_event.index,
            message_index: message_event.event.message_index,
            timestamp: now,
            transfer,
        })
    } else {
        Success(SuccessResult {
            chat_id: recipient.into(),
            event_index: message_event.index,
            message_index: message_event.event.message_index,
            timestamp: now,
        })
    }
}

pub(crate) async fn send_to_recipients_canister(
    recipient: UserId,
    args: c2c_send_message::Args,
    cycles_transfer: Option<CyclesTransferDetails>,
    is_retry: bool,
) {
    let cycles_to_send = cycles_transfer.as_ref().map_or(0, |ct| ct.transfer.cycles);

    // Note: We ignore any Blocked responses - it means the sender won't know they're blocked
    // but maybe that is not so bad. Otherwise we would have to wait for the call to the
    // recipient canister which would double the latency of every message.
    match user_canister_c2c_client::c2c_send_message(recipient.into(), &args, cycles_to_send).await {
        Ok(_) => {
            if let Some(ct) = cycles_transfer {
                handle_successful_cycles_transfer(ct.index, ct.transfer);
            }
        }
        Err(error) => {
            if is_retry {
                // If this is already a retry, don't try sending again
                error!(?error, ?recipient, "Failed to send message to recipient even after retrying");
                if let Some(ct) = cycles_transfer {
                    let failed_cycles_transfer = FailedCyclesTransfer {
                        recipient: ct.transfer.recipient,
                        cycles: ct.transfer.cycles,
                        error_message: format!("{error:?}"),
                    };
                    handle_failed_cycles_transfer(ct.index, failed_cycles_transfer);
                }
            } else {
                // If this is not a retry, queue up the message to be retried
                let user_index_canister_id =
                    mutate_state(|state| queue_failed_message_for_retry(recipient, args, cycles_transfer, state));

                let _ = user_index_canister_c2c_client::c2c_mark_send_message_failed(
                    user_index_canister_id,
                    &user_index_canister::c2c_mark_send_message_failed::Args { recipient },
                )
                .await;
            }
        }
    }
}

// Returns the user_index_canister_id
fn queue_failed_message_for_retry(
    recipient: UserId,
    args: c2c_send_message::Args,
    cycles_transfer: Option<CyclesTransferDetails>,
    runtime_state: &mut RuntimeState,
) -> CanisterId {
    runtime_state
        .data
        .failed_messages_pending_retry
        .add(recipient, args, cycles_transfer);

    runtime_state.data.user_index_canister_id
}
