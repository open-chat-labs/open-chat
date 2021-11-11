use crate::guards::caller_is_owner;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use chat_events::PushMessageArgs;
use ic_cdk_macros::update;
use serde::{Deserialize, Serialize};
use tracing::error;
use types::{
    CanisterId, CompletedCyclesTransfer, CompletedICPTransfer, CryptocurrencyTransfer, CyclesTransfer, FailedCyclesTransfer,
    ICPTransfer, MessageContent, MessageIndex, PendingCyclesTransfer, PendingICPTransfer, Transaction, UserId,
};
use user_canister::c2c_send_message;
use user_canister::send_message::{Response::*, *};
use utils::consts::{DEFAULT_MEMO, ICP_TRANSACTION_FEE_E8S};

// The args are mutable because if the request contains a pending transfer, we process the transfer
// and then update the message content to contain the completed transfer.
#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message(mut args: Args) -> Response {
    run_regular_jobs();

    if RUNTIME_STATE.with(|state| is_recipient_blocked(&args.recipient, state.borrow().as_ref().unwrap())) {
        return RecipientBlocked;
    }

    let mut cycles_transfer = None;
    // If the message includes a pending cryptocurrency transfer, we process that and then update
    // the message to contain the completed transfer.
    if let MessageContent::Cryptocurrency(c) = &mut args.content {
        match &mut c.transfer {
            CryptocurrencyTransfer::Cycles(CyclesTransfer::Pending(pending_transfer)) => {
                if pending_transfer.recipient != args.recipient {
                    return InvalidRequest("Transfer recipient does not match message recipient".to_owned());
                }
                match subtract_cycles_from_user_balance(pending_transfer) {
                    Ok(completed_transfer) => {
                        c.transfer =
                            CryptocurrencyTransfer::Cycles(CyclesTransfer::Completed(completed_transfer.transfer.clone()));
                        cycles_transfer = Some(completed_transfer);
                    }
                    Err(response) => return response,
                };
            }
            CryptocurrencyTransfer::ICP(ICPTransfer::Pending(pending_transfer)) => {
                if pending_transfer.recipient != args.recipient {
                    return InvalidRequest("Transfer recipient does not match message recipient".to_owned());
                }
                match send_icp(args.recipient, pending_transfer).await {
                    Ok(completed_transfer) => {
                        c.transfer = CryptocurrencyTransfer::ICP(ICPTransfer::Completed(completed_transfer))
                    }
                    Err(error) => return TransactionFailed(error),
                };
            }
            _ => return InvalidRequest("Can only send pending transfers".to_owned()),
        }
    }

    RUNTIME_STATE.with(|state| send_message_impl(args, cycles_transfer, state.borrow_mut().as_mut().unwrap()))
}

fn send_message_impl(args: Args, cycles_transfer: Option<CyclesTransferDetails>, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let my_user_id = runtime_state.env.canister_id().into();
    let recipient = args.recipient;

    let push_message_args = PushMessageArgs {
        message_id: args.message_id,
        sender: my_user_id,
        content: args.content.clone(),
        replies_to: args.replies_to.clone(),
        now,
    };

    let (chat_id, event_index, message) =
        runtime_state
            .data
            .direct_chats
            .push_message(true, recipient, None, push_message_args);

    let c2c_args = build_c2c_args(args, message.message_index);
    ic_cdk::block_on(send_to_recipients_canister(recipient, c2c_args, cycles_transfer, false));

    Success(SuccessResult {
        chat_id,
        event_index,
        message_index: message.message_index,
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
                RUNTIME_STATE.with(|state| {
                    let transfer = CryptocurrencyTransfer::Cycles(CyclesTransfer::Completed(ct.transfer));
                    update_transaction(ct.index, transfer, state.borrow_mut().as_mut().unwrap())
                });
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
                        error_message: format!("{:?}", error),
                    };
                    RUNTIME_STATE.with(|state| {
                        handle_failed_cycles_transfer(ct.index, failed_cycles_transfer, state.borrow_mut().as_mut().unwrap());
                    });
                }
            } else {
                // If this is not a retry, queue up the message to be retried
                let user_index_canister_id = RUNTIME_STATE.with(|state| {
                    queue_failed_message_for_retry(recipient, args, cycles_transfer, state.borrow_mut().as_mut().unwrap())
                });

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

async fn send_icp(my_user_id: UserId, pending_transfer: &PendingICPTransfer) -> Result<CompletedICPTransfer, String> {
    let index = RUNTIME_STATE.with(|state| {
        record_transaction(
            CryptocurrencyTransfer::ICP(ICPTransfer::Pending(pending_transfer.clone())),
            state.borrow_mut().as_mut().unwrap(),
        )
    });

    let address = ledger_utils::calculate_address(pending_transfer.recipient);
    let fee_e8s = pending_transfer.fee_e8s.unwrap_or(ICP_TRANSACTION_FEE_E8S);
    let memo = pending_transfer.memo.unwrap_or(DEFAULT_MEMO);

    match ledger_utils::send(address, pending_transfer.amount_e8s, fee_e8s, memo).await {
        Ok(block_height) => {
            let completed_transfer = pending_transfer.completed(my_user_id, fee_e8s, memo, block_height);
            RUNTIME_STATE.with(|state| {
                update_transaction(
                    index,
                    CryptocurrencyTransfer::ICP(ICPTransfer::Completed(completed_transfer.clone())),
                    state.borrow_mut().as_mut().unwrap(),
                )
            });
            Ok(completed_transfer)
        }
        Err(error) => {
            let failed_transfer = pending_transfer.failed(fee_e8s, memo, error.clone());
            RUNTIME_STATE.with(|state| {
                update_transaction(
                    index,
                    CryptocurrencyTransfer::ICP(ICPTransfer::Failed(failed_transfer)),
                    state.borrow_mut().as_mut().unwrap(),
                )
            });
            Err(error)
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct CyclesTransferDetails {
    index: u32,
    transfer: CompletedCyclesTransfer,
}

// If the user has enough cycles to cover the transfer, reduce their balance by the transfer amount
// and log the pending transfer, else log a failed transfer.
fn subtract_cycles_from_user_balance(transfer: &PendingCyclesTransfer) -> Result<CyclesTransferDetails, Response> {
    fn subtract_cycles_from_user_balance_impl(
        transfer: &PendingCyclesTransfer,
        runtime_state: &mut RuntimeState,
    ) -> Result<CyclesTransferDetails, Response> {
        if runtime_state
            .data
            .user_cycles_balance
            .try_subtract(transfer.cycles, runtime_state.env.now())
        {
            let index = record_transaction(
                CryptocurrencyTransfer::Cycles(CyclesTransfer::Pending(transfer.clone())),
                runtime_state,
            );
            let my_user_id = runtime_state.env.canister_id().into();
            let completed_transfer = transfer.completed(my_user_id);
            Ok(CyclesTransferDetails {
                index,
                transfer: completed_transfer,
            })
        } else {
            let error_message = "Insufficient cycles".to_owned();
            let failed_transfer = transfer.failed(error_message.clone());
            record_transaction(
                CryptocurrencyTransfer::Cycles(CyclesTransfer::Failed(failed_transfer)),
                runtime_state,
            );
            Err(TransactionFailed(error_message))
        }
    }

    RUNTIME_STATE.with(|state| subtract_cycles_from_user_balance_impl(transfer, state.borrow_mut().as_mut().unwrap()))
}

fn handle_failed_cycles_transfer(index: u32, failed_transfer: FailedCyclesTransfer, runtime_state: &mut RuntimeState) {
    runtime_state
        .data
        .user_cycles_balance
        .add(failed_transfer.cycles, runtime_state.env.now());

    update_transaction(
        index,
        CryptocurrencyTransfer::Cycles(CyclesTransfer::Failed(failed_transfer)),
        runtime_state,
    );
}

fn record_transaction<T: Into<Transaction>>(transaction: T, runtime_state: &mut RuntimeState) -> u32 {
    let now = runtime_state.env.now();
    runtime_state.data.transactions.add(transaction, now)
}

fn update_transaction<T: Into<Transaction>>(index: u32, transaction: T, runtime_state: &mut RuntimeState) {
    runtime_state.data.transactions.update(index, transaction);
}
