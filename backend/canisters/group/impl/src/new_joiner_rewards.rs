use crate::{mutate_state, NewJoinerRewardStatus, RuntimeState};
use chat_events::PushMessageArgs;
use ic_ledger_types::{Memo, Timestamp, TransferArgs, DEFAULT_FEE};
use ledger_utils::{calculate_transaction_hash, default_ledger_account};
use tracing::error;
use types::nns::CryptoAccount;
use types::{
    nns, CanisterId, CompletedCryptoTransaction, CryptoContent, CryptoTransaction, Cryptocurrency, MessageContentInternal,
    MessageId, TimestampMillis, UserId, ICP,
};
use utils::consts::OPENCHAT_BOT_USER_ID;

pub async fn process_new_joiner_reward(
    this_canister_id: CanisterId,
    user_id: UserId,
    ledger_canister_id: CanisterId,
    amount: ICP,
    now: TimestampMillis,
) {
    let to = default_ledger_account(user_id.into());

    let transfer_args = TransferArgs {
        memo: Memo(0),
        amount,
        fee: DEFAULT_FEE,
        from_subaccount: None,
        to,
        created_at_time: Some(Timestamp {
            timestamp_nanos: now * 1000 * 1000,
        }),
    };
    let transaction_hash = calculate_transaction_hash(this_canister_id, &transfer_args);

    match ic_ledger_types::transfer(ledger_canister_id, transfer_args).await {
        Ok(Ok(block_index)) => {
            mutate_state(|state| {
                update_status(&user_id, NewJoinerRewardStatus::Completed(block_index), state);

                send_reward_transferred_message(
                    user_id,
                    nns::CompletedCryptoTransaction {
                        token: Cryptocurrency::InternetComputer,
                        amount,
                        fee: DEFAULT_FEE,
                        from: CryptoAccount::Account(default_ledger_account(this_canister_id)),
                        to: CryptoAccount::Account(to),
                        memo: Memo(0),
                        created: state.env.now(),
                        transaction_hash,
                        block_index,
                    },
                    state,
                )
            });
        }
        Ok(Err(error)) => {
            error!(?user_id, ?amount, ?error, "Unable to transfer user reward");
            mutate_state(|state| update_status(&user_id, NewJoinerRewardStatus::Failed(format!("{error:?}")), state));
        }
        Err(error) => {
            error!(?user_id, ?amount, ?error, "Unable to transfer user reward");
            mutate_state(|state| update_status(&user_id, NewJoinerRewardStatus::Failed(format!("{error:?}")), state));
        }
    }
}

fn update_status(user_id: &UserId, status: NewJoinerRewardStatus, runtime_state: &mut RuntimeState) {
    if let Some(new_joiner_rewards) = &mut runtime_state.data.new_joiner_rewards {
        new_joiner_rewards.update_status(user_id, status);
    }
}

fn send_reward_transferred_message(
    user_id: UserId,
    transfer: nns::CompletedCryptoTransaction,
    runtime_state: &mut RuntimeState,
) {
    runtime_state.data.events.push_message(PushMessageArgs {
        sender: OPENCHAT_BOT_USER_ID,
        thread_root_message_index: None,
        message_id: MessageId::generate(|| runtime_state.env.random_u32()),
        content: MessageContentInternal::Crypto(CryptoContent {
            recipient: user_id,
            transfer: CryptoTransaction::Completed(CompletedCryptoTransaction::NNS(transfer)),
            caption: None,
        }),
        replies_to: None,
        forwarded: false,
        correlation_id: 0,
        now: runtime_state.env.now(),
    });
}
