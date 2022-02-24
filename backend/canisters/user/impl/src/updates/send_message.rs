use super::crypto::cycles::{
    handle_failed_cycles_transfer, handle_successful_cycles_transfer, start_cycles_transfer, CyclesTransferDetails,
};
use super::crypto::icp::send_icp;
use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::PushMessageArgs;
use ic_cdk_macros::update;
use tracing::error;
use types::{
    CanisterId, ContentValidationError, CryptocurrencyTransfer, CyclesTransfer, FailedCyclesTransfer, ICPTransfer,
    MessageContent, MessageIndex, UserId,
};
use user_canister::c2c_send_message;
use user_canister::send_message::{Response::*, *};

// The args are mutable because if the request contains a pending transfer, we process the transfer
// and then update the message content to contain the completed transfer.
#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message(mut args: Args) -> Response {
    run_regular_jobs();

    let now = read_state(|state| state.env.now());

    if let Err(error) = args.content.validate_for_new_message(now) {
        return match error {
            ContentValidationError::Empty => MessageEmpty,
            ContentValidationError::TextTooLong(max_length) => TextTooLong(max_length),
            ContentValidationError::InvalidPoll(reason) => InvalidPoll(reason),
        };
    }

    if read_state(|state| is_recipient_blocked(&args.recipient, state)) {
        return RecipientBlocked;
    }

    let mut cycles_transfer = None;
    // If the message includes a pending cryptocurrency transfer, we process that and then update
    // the message to contain the completed transfer.
    if let MessageContent::Cryptocurrency(c) = &mut args.content {
        match c.transfer.clone() {
            CryptocurrencyTransfer::Cycles(CyclesTransfer::Pending(pending_transfer)) => {
                if pending_transfer.recipient != args.recipient {
                    return InvalidRequest("Transfer recipient does not match message recipient".to_owned());
                }
                match start_cycles_transfer(pending_transfer) {
                    Ok(completed_transfer) => {
                        c.transfer =
                            CryptocurrencyTransfer::Cycles(CyclesTransfer::Completed(completed_transfer.transfer.clone()));
                        cycles_transfer = Some(completed_transfer);
                    }
                    Err(failed_transfer) => return TransactionFailed(failed_transfer.error_message),
                };
            }
            CryptocurrencyTransfer::ICP(ICPTransfer::Pending(pending_transfer)) => {
                if pending_transfer.recipient != args.recipient {
                    return InvalidRequest("Transfer recipient does not match message recipient".to_owned());
                }
                match send_icp(pending_transfer).await {
                    Ok(completed_transfer) => {
                        c.transfer = CryptocurrencyTransfer::ICP(ICPTransfer::Completed(completed_transfer))
                    }
                    Err(failed_transfer) => return TransactionFailed(failed_transfer.error_message),
                };
            }
            _ => return InvalidRequest("Can only send pending transfers".to_owned()),
        }
    }

    mutate_state(|state| send_message_impl(args, cycles_transfer, state))
}

fn send_message_impl(args: Args, cycles_transfer: Option<CyclesTransferDetails>, runtime_state: &mut RuntimeState) -> Response {
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

    let c2c_args = build_c2c_args(args, message_event.event.message_index);
    ic_cdk::spawn(send_to_recipients_canister(recipient, c2c_args, cycles_transfer, false));

    Success(SuccessResult {
        chat_id: recipient.into(),
        event_index: message_event.index,
        message_index: message_event.event.message_index,
        timestamp: now,
    })
}

fn is_recipient_blocked(recipient: &UserId, runtime_state: &RuntimeState) -> bool {
    runtime_state.data.blocked_users.contains(recipient)
}

fn build_c2c_args(args: Args, message_index: MessageIndex) -> c2c_send_message::Args {
    c2c_send_message::Args {
        message_id: args.message_id,
        sender_name: args.sender_name,
        sender_message_index: message_index,
        content: args.content,
        replies_to: args.replies_to,
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
