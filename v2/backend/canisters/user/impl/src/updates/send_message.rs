use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use chat_events::PushMessageArgs;
use ic_cdk_macros::update;
use tracing::instrument;
use types::{
    BlockHeight, CanisterId, Cryptocurrency, CryptocurrencySend, CryptocurrencyTransaction, CryptocurrencyTransfer, Cycles,
    MessageContent, MessageIndex, Timestamped, Transaction, TransactionStatus, UserId,
};
use user_canister::c2c_send_message;
use user_canister::send_message::{Response::*, *};
use utils::consts::ICP_TRANSACTION_FEE_E8S;

#[update]
#[instrument(level = "trace")]
async fn send_message(mut args: Args) -> Response {
    run_regular_jobs();

    if let Err(response) = RUNTIME_STATE.with(|state| validate_request(&args.recipient, state.borrow().as_ref().unwrap())) {
        return response;
    }

    // If the message includes an ICP transaction we must handle that transaction before we send the
    // message to the recipient.
    if let MessageContent::ICP(c) = &mut args.content {
        match send_icp_transaction(args.recipient, c.amount_e8s).await {
            Ok(block_height) => {
                // Assign the block height on the request
                c.block_height = block_height;
            }
            Err(error) => {
                return TransactionFailed(error);
            }
        };
    }

    RUNTIME_STATE.with(|state| send_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    let mut cycles_transaction = None;
    if let MessageContent::Cycles(c) = &args.content {
        match prepare_cycles_transaction(args.recipient, c.amount, runtime_state) {
            Ok(ct) => cycles_transaction = Some(ct),
            Err(response) => return response,
        };
    }

    let my_user_id = runtime_state.env.canister_id().into();
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
            .push_message(true, args.recipient, None, push_message_args);

    let (canister_id, c2c_args) = build_c2c_args(args, message.message_index);
    ic_cdk::block_on(send_to_recipients_canister(canister_id, c2c_args, cycles_transaction));

    Success(SuccessResult {
        chat_id,
        event_index,
        message_index: message.message_index,
        timestamp: now,
    })
}

fn validate_request(recipient: &UserId, runtime_state: &RuntimeState) -> Result<(), Response> {
    runtime_state.trap_if_caller_not_owner();

    if !runtime_state.data.blocked_users.contains(recipient) {
        Ok(())
    } else {
        Err(RecipientBlocked)
    }
}

fn build_c2c_args(args: Args, message_index: MessageIndex) -> (CanisterId, c2c_send_message::Args) {
    let c2c_args = c2c_send_message::Args {
        message_id: args.message_id,
        sender_name: args.sender_name,
        sender_message_index: message_index,
        content: args.content,
        replies_to: args.replies_to,
    };

    (args.recipient.into(), c2c_args)
}

async fn send_to_recipients_canister(
    canister_id: CanisterId,
    args: c2c_send_message::Args,
    cycles_transaction: Option<CyclesTransaction>,
) {
    let (cycles_transaction_index, cycles_to_send) = cycles_transaction.map_or((None, 0), |ct| (Some(ct.index), ct.cycles));

    // Note: We ignore any Block responses - it means the sender won't know they're blocked
    // but maybe that is not so bad. Otherwise we would have to wait for the call to the
    // recipient canister which would double the latency of every message.
    match user_canister_c2c_client::c2c_send_message(canister_id, &args, cycles_to_send).await {
        Ok(_) => {
            if let Some(index) = cycles_transaction_index {
                RUNTIME_STATE.with(|state| mark_transaction_complete(index, None, state.borrow_mut().as_mut().unwrap()));
            }
        }
        Err(error) => {
            if let Some(index) = cycles_transaction_index {
                RUNTIME_STATE.with(|state| {
                    handle_failed_cycles_transfer(
                        index,
                        format!("{:?}", error),
                        cycles_to_send,
                        state.borrow_mut().as_mut().unwrap(),
                    );
                });
            }
        }
    }
}

async fn send_icp_transaction(recipient: UserId, amount_e8s: u64) -> Result<BlockHeight, String> {
    let address = ledger_utils::calculate_address(recipient);
    let fee = ICP_TRANSACTION_FEE_E8S;
    let mut transaction = CryptocurrencyTransaction {
        currency: Cryptocurrency::ICP,
        block_height: None,
        transfer: CryptocurrencyTransfer::Send(CryptocurrencySend {
            to_user: recipient,
            to: address.to_string(),
            amount: amount_e8s.into(),
            fee: fee.into(),
        }),
    };

    let index = RUNTIME_STATE.with(|state| {
        record_transaction(
            Transaction::Cryptocurrency(transaction.clone()),
            TransactionStatus::Pending,
            state.borrow_mut().as_mut().unwrap(),
        )
    });

    match ledger_utils::send(address, amount_e8s, fee).await {
        Ok(block_height) => {
            transaction.block_height = Some(block_height);
            RUNTIME_STATE.with(|state| {
                mark_transaction_complete(
                    index,
                    Some(Transaction::Cryptocurrency(transaction)),
                    state.borrow_mut().as_mut().unwrap(),
                )
            });
            Ok(block_height)
        }
        Err(error) => {
            RUNTIME_STATE.with(|state| mark_transaction_failed(index, error.clone(), state.borrow_mut().as_mut().unwrap()));
            Err(error)
        }
    }
}

struct CyclesTransaction {
    index: u32,
    cycles: Cycles,
}

fn prepare_cycles_transaction(
    recipient: UserId,
    cycles: Cycles,
    runtime_state: &mut RuntimeState,
) -> Result<CyclesTransaction, Response> {
    let transaction = Transaction::Cryptocurrency(CryptocurrencyTransaction {
        currency: Cryptocurrency::Cycles,
        block_height: None,
        transfer: CryptocurrencyTransfer::Send(CryptocurrencySend {
            to_user: recipient,
            to: recipient.to_string(),
            amount: cycles,
            fee: 0,
        }),
    });

    if let Some(new_cycles_balance) = runtime_state.data.user_cycles_balance.value.checked_sub(cycles) {
        let now = runtime_state.env.now();
        runtime_state.data.user_cycles_balance = Timestamped::new(new_cycles_balance, now);
        let index = record_transaction(transaction, TransactionStatus::Pending, runtime_state);
        Ok(CyclesTransaction { index, cycles })
    } else {
        Err(TransactionFailed("Insufficient cycles".to_owned()))
    }
}

fn handle_failed_cycles_transfer(index: u32, error: String, cycles: Cycles, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    let new_cycles_balance = runtime_state.data.user_cycles_balance.value + cycles;
    runtime_state.data.user_cycles_balance = Timestamped::new(new_cycles_balance, now);
    mark_transaction_failed(index, error, runtime_state);
}

fn record_transaction(transaction: Transaction, status: TransactionStatus, runtime_state: &mut RuntimeState) -> u32 {
    let now = runtime_state.env.now();
    runtime_state.data.transactions.add(transaction, now, status)
}

fn mark_transaction_complete(index: u32, transaction: Option<Transaction>, runtime_state: &mut RuntimeState) {
    runtime_state
        .data
        .transactions
        .update(index, TransactionStatus::Complete, transaction);
}

fn mark_transaction_failed(index: u32, error: String, runtime_state: &mut RuntimeState) {
    runtime_state
        .data
        .transactions
        .update(index, TransactionStatus::Failed(error), None);
}
