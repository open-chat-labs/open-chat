use crate::model::pending_actions_queue::{Action, AirdropMessage, AirdropTransfer, AirdropType, LotteryAirdrop, MainAidrop};
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use rand::Rng;
use std::cell::Cell;
use std::time::Duration;
use time::macros::format_description;
use tracing::{error, trace};
use types::icrc1::{self};
use types::{
    BotMessage, CanisterId, ChannelId, CommunityId, CompletedCryptoTransaction, CryptoContent, CryptoTransaction,
    Cryptocurrency, MessageContentInitial,
};
use utils::consts::{MEMO_CHIT_FOR_CHAT_AIRDROP, MEMO_CHIT_FOR_CHAT_LOTTERY};

use super::execute_airdrop::start_airdrop_timer;

const MAX_BATCH_SIZE: usize = 5;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState, after: Option<Duration>) -> bool {
    if TIMER_ID.get().is_none() && !state.data.pending_actions_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(after.unwrap_or_default(), run);
        TIMER_ID.set(Some(timer_id));
        trace!("'process_pending_actions' job started");
        true
    } else {
        false
    }
}

fn run() {
    let batch = mutate_state(next_batch);
    if !batch.is_empty() {
        ic_cdk::spawn(process_actions(batch));
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'process_pending_actions' job stopped");
    }
}

fn next_batch(state: &mut RuntimeState) -> Vec<Action> {
    (0..MAX_BATCH_SIZE)
        .map_while(|_| state.data.pending_actions_queue.pop())
        .collect()
}

async fn process_actions(actions: Vec<Action>) {
    let futures: Vec<_> = actions.into_iter().map(process_action).collect();

    futures::future::join_all(futures).await;
}

async fn process_action(action: Action) {
    match action.clone() {
        Action::JoinChannel(community_id, channel_id) => join_channel(community_id, channel_id).await,
        Action::SendMessage(action) if matches!(action.airdrop_type, AirdropType::Lottery(_)) => {
            handle_lottery_message_action(*action).await
        }
        Action::SendMessage(action) => handle_main_message_action(*action).await,
        Action::Transfer(action) => handle_transfer_action(*action).await,
    }
}

async fn join_channel(community_id: CommunityId, channel_id: ChannelId) {
    let local_user_index_canister_id = match community_canister_c2c_client::local_user_index(
        community_id.into(),
        &community_canister::local_user_index::Args {},
    )
    .await
    {
        Ok(community_canister::local_user_index::Response::Success(canister_id)) => canister_id,
        Err(err) => {
            error!("Failed to get local_user_index {err:?}");
            mutate_state(|state| {
                state.enqueue_pending_action(Action::JoinChannel(community_id, channel_id), Some(Duration::from_secs(60)))
            });
            return;
        }
    };

    match local_user_index_canister_c2c_client::join_channel(
        local_user_index_canister_id,
        &local_user_index_canister::join_channel::Args {
            community_id,
            channel_id,
            invite_code: None,
            verified_credential_args: None,
        },
    )
    .await
    {
        Ok(_) => (),
        Err(err) => {
            error!("Failed to get join_channel {err:?}");
            mutate_state(|state| {
                state.enqueue_pending_action(Action::JoinChannel(community_id, channel_id), Some(Duration::from_secs(60)))
            });
            return;
        }
    }

    read_state(start_airdrop_timer);
}

async fn handle_transfer_action(action: AirdropTransfer) {
    let (this_canister_id, ledger_canister_id, now_nanos) = read_state(|state| {
        (
            state.env.canister_id(),
            state.data.chat_ledger_canister_id,
            state.env.now_nanos(),
        )
    });

    let token = Cryptocurrency::CHAT;
    let to = Account::from(Principal::from(action.recipient));
    let memo = match action.airdrop_type {
        AirdropType::Main(_) => MEMO_CHIT_FOR_CHAT_AIRDROP,
        AirdropType::Lottery(_) => MEMO_CHIT_FOR_CHAT_LOTTERY,
    };

    let args = TransferArg {
        from_subaccount: None,
        to,
        fee: token.fee().map(|f| f.into()),
        created_at_time: Some(now_nanos),
        memo: Some(memo.to_vec().into()),
        amount: action.amount.into(),
    };

    match icrc_ledger_canister_c2c_client::icrc1_transfer(ledger_canister_id, &args).await {
        Ok(Ok(block_index)) => {
            mutate_state(|state| {
                let fee = token.fee().unwrap();
                let block_index = block_index.0.try_into().unwrap();

                state.enqueue_pending_action(
                    Action::SendMessage(Box::new(AirdropMessage {
                        recipient: action.recipient,
                        transaction: CompletedCryptoTransaction::ICRC1(icrc1::CompletedCryptoTransaction {
                            ledger: ledger_canister_id,
                            token,
                            amount: action.amount,
                            fee,
                            from: Account::from(this_canister_id).into(),
                            to: to.into(),
                            memo: Some(memo.to_vec().into()),
                            created: now_nanos,
                            block_index,
                        }),
                        airdrop_type: action.airdrop_type.clone(),
                    })),
                    None,
                );

                match action.airdrop_type {
                    AirdropType::Lottery(LotteryAirdrop { position }) => {
                        state.data.airdrops.set_lottery_transaction(position, block_index)
                    }
                    AirdropType::Main(_) => state.data.airdrops.set_main_transaction(&action.recipient, block_index),
                }
            });
        }
        Ok(Err(TransferError::InsufficientFunds { balance })) => {
            error!(?args, ?balance, "Failed to transfer CHAT, insufficient funds");
        }
        Ok(error) => {
            error!(?args, ?error, "Failed to transfer CHAT");
        }
        Err(error) => {
            error!(?args, ?error, "Failed to transfer CHAT, retrying");
            mutate_state(|state| state.enqueue_pending_action(Action::Transfer(Box::new(action)), None))
        }
    }
}

async fn handle_main_message_action(action: AirdropMessage) {
    let AirdropType::Main(MainAidrop { chit, shares }) = action.airdrop_type else {
        return;
    };

    let Some((username, display_name, month)) = read_state(|state| {
        state
            .data
            .airdrops
            .current(state.env.now())
            .and_then(|c| {
                let date = time::OffsetDateTime::from_unix_timestamp((c.start / 1000) as i64).unwrap();
                let format = format_description!("[month repr:long]");
                date.format(format).ok()
            })
            .map(|m| (state.data.username.clone(), state.data.display_name.clone(), m))
    }) else {
        return;
    };

    let args = user_canister::c2c_handle_bot_messages::Args {
        bot_name: username,
        bot_display_name: display_name,
        messages: vec![BotMessage {
            thread_root_message_id: None,
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: action.recipient,
                transfer: CryptoTransaction::Completed(action.transaction.clone()),
                caption: Some(format!(
                    "Congratulations! In {month} you earned {chit} CHIT giving you {shares} shares in the CHIT for CHAT airdrop."
                )),
            }),
            message_id: None,
            block_level_markdown: None,
        }],
    };

    if user_canister_c2c_client::c2c_handle_bot_messages(CanisterId::from(action.recipient), &args)
        .await
        .is_err()
    {
        mutate_state(|state| state.enqueue_pending_action(Action::SendMessage(Box::new(action)), None));
    }
}

async fn handle_lottery_message_action(action: AirdropMessage) {
    let AirdropType::Lottery(LotteryAirdrop { position }): AirdropType = action.airdrop_type else {
        return;
    };

    let Some((username, community_id, channel_id, message_id)) = mutate_state(|state| {
        state.data.airdrops.current(state.env.now()).map(|c| {
            (
                state.data.username.clone(),
                c.community_id,
                c.channel_id,
                state.env.rng().gen(),
            )
        })
    }) else {
        return;
    };

    let position = match position {
        0 => "1st",
        1 => "2nd",
        2 => "3rd",
        n => {
            let n = n + 1;
            &format!("{n}th")
        }
    };

    let args = community_canister::send_message::Args {
        channel_id,
        thread_root_message_index: None,
        message_id,
        content: MessageContentInitial::Crypto(CryptoContent {
            recipient: action.recipient,
            transfer: CryptoTransaction::Completed(action.transaction.clone()),
            caption: Some(format!(
                "Congratulations! You have won {position} prize in the CHIT for CHAT airdrop lottery!"
            )),
        }),
        sender_name: username,
        sender_display_name: None,
        replies_to: None,
        mentioned: Vec::new(),
        forwarding: false,
        block_level_markdown: false,
        community_rules_accepted: None,
        channel_rules_accepted: None,
        message_filter_failed: None,
        new_achievement: false,
    };

    if community_canister_c2c_client::send_message(community_id.into(), &args)
        .await
        .is_err()
    {
        mutate_state(|state| state.enqueue_pending_action(Action::SendMessage(Box::new(action)), None));
    }
}
