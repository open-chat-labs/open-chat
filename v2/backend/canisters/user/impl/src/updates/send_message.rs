use crate::{run_regular_jobs, Data, RuntimeState, RUNTIME_STATE};
use chat_events::PushMessageArgs;
use ic_cdk_macros::update;
use tracing::instrument;
use types::{
    CanisterId, Cryptocurrency, CryptocurrencySend, CryptocurrencyTransaction, CryptocurrencyTransfer, Cycles, MessageContent,
    MessageIndex, TimestampMillis, Timestamped, Transaction, UserId,
};
use user_canister::c2c_send_message;
use user_canister::send_message::{Response::*, *};

#[update]
#[instrument(level = "trace")]
async fn send_message(args: Args) -> Response {
    run_regular_jobs();

    let transaction = match send_transaction_if_required(&args).await {
        Ok(t) => t,
        Err(error) => return TransactionFailed(error),
    };

    RUNTIME_STATE.with(|state| send_message_impl(args, transaction, state.borrow_mut().as_mut().unwrap()))
}

fn send_message_impl(args: Args, transaction: Option<Transaction>, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    if runtime_state.data.blocked_users.contains(&args.recipient) {
        return RecipientBlocked;
    }

    let now = runtime_state.env.now();

    let mut cycles_to_send: Cycles = 0;
    if let Some(transaction) = transaction {
        runtime_state.data.transactions.add(transaction, now);
    } else if let MessageContent::Cycles(c) = &args.content {
        if !prepare_and_log_cycles_transaction(args.recipient, c.amount, now, &mut runtime_state.data) {
            return InsufficientCycles;
        }
        cycles_to_send = c.amount;
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
    ic_cdk::block_on(send_to_recipients_canister(canister_id, c2c_args, cycles_to_send));

    Success(SuccessResult {
        chat_id,
        event_index,
        message_index: message.message_index,
        timestamp: now,
    })
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

async fn send_to_recipients_canister(canister_id: CanisterId, args: c2c_send_message::Args, cycles: Cycles) {
    // Note: We ignore any Block response - it means the sender won't know they're blocked
    // but maybe that is not so bad. Otherwise we would have to wait for the call to the
    // recipient canister which would double the latency of every message.
    let _ = user_canister_c2c_client::c2c_send_message(canister_id, &args, cycles).await;
}

async fn send_transaction_if_required(args: &Args) -> Result<Option<Transaction>, String> {
    match &args.content {
        MessageContent::ICP(c) => {
            let address = ledger_utils::calculate_address(args.recipient);
            match ledger_utils::send(address, c.amount_e8s).await {
                Ok(result) => Ok(Some(Transaction::Cryptocurrency(CryptocurrencyTransaction {
                    currency: Cryptocurrency::ICP,
                    block_height: Some(result.block_height),
                    transfer: CryptocurrencyTransfer::Send(CryptocurrencySend {
                        to_user: args.recipient,
                        to: address.to_string(),
                        amount: c.amount_e8s.into(),
                        fee: result.fee_e8s.into(),
                    }),
                }))),
                Err(error) => Err(error),
            }
        }
        _ => Ok(None),
    }
}

fn prepare_and_log_cycles_transaction(recipient: UserId, amount: Cycles, now: TimestampMillis, data: &mut Data) -> bool {
    if let Some(new_cycles_balance) = data.user_cycles_balance.value.checked_sub(amount) {
        let transaction = Transaction::Cryptocurrency(CryptocurrencyTransaction {
            currency: Cryptocurrency::Cycles,
            block_height: None,
            transfer: CryptocurrencyTransfer::Send(CryptocurrencySend {
                to_user: recipient,
                to: recipient.to_string(),
                amount,
                fee: 0,
            }),
        });
        data.transactions.add(transaction, now);
        data.user_cycles_balance = Timestamped::new(new_cycles_balance, now);
        true
    } else {
        false
    }
}
