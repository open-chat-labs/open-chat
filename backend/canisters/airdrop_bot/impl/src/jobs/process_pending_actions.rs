use crate::jobs::execute_airdrop::start_airdrop_timer;
use crate::model::pending_actions_queue::{Action, AirdropMessage, AirdropTransfer, AirdropType, LotteryAirdrop, MainAidrop};
use crate::{mutate_state, read_state, RuntimeState, USERNAME};
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use rand::Rng;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info, trace};
use types::icrc1::{self, Account};
use types::{
    BotMessage, CanisterId, ChannelId, CommunityId, CompletedCryptoTransaction, CryptoContent, CryptoTransaction,
    Cryptocurrency, MessageContentInitial,
};
use utils::consts::{MEMO_CHIT_FOR_CHAT_AIRDROP, MEMO_CHIT_FOR_CHAT_LOTTERY};
use utils::time::{MonthKey, MONTHS};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

const BATCH_SIZE: usize = 10;

pub(crate) fn start_job_if_required(state: &RuntimeState, after: Option<Duration>) -> bool {
    if TIMER_ID.get().is_none() && !state.data.pending_actions_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(after.unwrap_or_default(), run);
        TIMER_ID.set(Some(timer_id));
        trace!("'process_pending_actions' job started");
        true
    } else {
        false
    }
}

fn run() {
    TIMER_ID.set(None);

    let batch = mutate_state(next_batch);
    if !batch.is_empty() {
        ic_cdk::spawn(process_batch(batch));
        read_state(|state| start_job_if_required(state, None));
    }
}

fn next_batch(state: &mut RuntimeState) -> Vec<Action> {
    let mut actions = Vec::new();
    while let Some(next) = state.data.pending_actions_queue.pop() {
        actions.push(next);
        if actions.len() == BATCH_SIZE {
            break;
        }
    }

    actions
}

async fn process_batch(batch: Vec<Action>) {
    let futures: Vec<_> = batch.into_iter().map(process_action).collect();
    futures::future::join_all(futures).await;
}

async fn process_action(action: Action) {
    match action {
        Action::JoinChannel(community_id, channel_id) => join_channel(community_id, channel_id).await,
        Action::SendMessage(a) if matches!(a.airdrop_type, AirdropType::Lottery(_)) => handle_lottery_message_action(*a).await,
        Action::SendMessage(a) => handle_main_message_action(*a).await,
        Action::Transfer(a) => handle_transfer_action(*a).await,
    }
}

async fn join_channel(community_id: CommunityId, channel_id: ChannelId) {
    info!(?community_id, ?channel_id, "Join channel");

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
                state.enqueue_pending_action(
                    Action::JoinChannel(community_id, channel_id),
                    Some(Duration::from_secs(60)),
                    false,
                )
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
            referred_by: None,
            verified_credential_args: None,
        },
    )
    .await
    {
        Ok(local_user_index_canister::join_channel::Response::Success(_))
        | Ok(local_user_index_canister::join_channel::Response::AlreadyInChannel(_))
        | Ok(local_user_index_canister::join_channel::Response::SuccessJoinedCommunity(_)) => (),
        Ok(local_user_index_canister::join_channel::Response::InternalError(err)) => {
            error!("Failed to join_channel {err:?}");
            mutate_state(|state| {
                state.enqueue_pending_action(
                    Action::JoinChannel(community_id, channel_id),
                    Some(Duration::from_secs(60)),
                    false,
                )
            });
            return;
        }
        Ok(resp) => {
            error!("Failed to join_channel {resp:?}");
            return;
        }
        Err(err) => {
            error!("Failed to join_channel {err:?}");
            mutate_state(|state| {
                state.enqueue_pending_action(
                    Action::JoinChannel(community_id, channel_id),
                    Some(Duration::from_secs(60)),
                    false,
                )
            });
            return;
        }
    }

    mutate_state(|state| state.data.channels_joined.insert((community_id, channel_id)));

    read_state(start_airdrop_timer);
}

async fn handle_transfer_action(action: AirdropTransfer) {
    let amount = action.amount.into();

    trace!(?amount, "CHAT Transfer");

    let (this_canister_id, ledger_canister_id, now_nanos) = read_state(|state| {
        (
            state.env.canister_id(),
            state.data.chat_ledger_canister_id,
            state.env.now_nanos(),
        )
    });

    let token = Cryptocurrency::CHAT;
    let to = Account::from(action.recipient);
    let memo = match action.airdrop_type {
        AirdropType::Main(_) => MEMO_CHIT_FOR_CHAT_AIRDROP,
        AirdropType::Lottery(_) => MEMO_CHIT_FOR_CHAT_LOTTERY,
    };

    let args = TransferArg {
        from_subaccount: None,
        to: to.into(),
        fee: token.fee().map(|f| f.into()),
        created_at_time: Some(now_nanos),
        memo: Some(memo.to_vec().into()),
        amount,
    };

    match icrc_ledger_canister_c2c_client::icrc1_transfer(ledger_canister_id, &args).await {
        Ok(Ok(block_index)) => {
            mutate_state(|state| {
                let fee = token.fee().unwrap();
                let block_index = block_index.0.try_into().unwrap();

                let message_action = Action::SendMessage(Box::new(AirdropMessage {
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
                }));

                state.data.pending_actions_queue.push_front(message_action);
                start_job_if_required(state, None);

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
            mutate_state(|state| state.enqueue_pending_action(Action::Transfer(Box::new(action)), None, true))
        }
    }
}

async fn handle_main_message_action(action: AirdropMessage) {
    trace!("Send DM");

    let AirdropType::Main(MainAidrop { chit, shares }) = action.airdrop_type else {
        return;
    };

    let Some(month) = read_state(|state| {
        state.data.airdrops.current(state.env.now()).map(|c| {
            let mk = MonthKey::from_timestamp(c.start).previous();
            MONTHS[mk.month() as usize - 1]
        })
    }) else {
        return;
    };

    let args = user_canister::c2c_handle_bot_messages::Args {
        bot_name: USERNAME.to_string(),
        bot_display_name: None,
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

    match user_canister_c2c_client::c2c_handle_bot_messages(CanisterId::from(action.recipient), &args).await {
        Ok(user_canister::c2c_handle_bot_messages::Response::Success) => (),
        Ok(resp) => {
            error!(?args, ?resp, "Failed to send DM");
        }
        Err(error) => {
            error!(?args, ?error, "Failed to send DM");
            mutate_state(|state| state.enqueue_pending_action(Action::SendMessage(Box::new(action)), None, true));
        }
    }
}

async fn handle_lottery_message_action(action: AirdropMessage) {
    info!("Send lottery winners message");

    let AirdropType::Lottery(LotteryAirdrop { position }): AirdropType = action.airdrop_type else {
        return;
    };

    let Some((community_id, channel_id, message_id)) = mutate_state(|state| {
        state
            .data
            .airdrops
            .current(state.env.now())
            .map(|c| (c.community_id, c.channel_id, state.env.rng().gen()))
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
        sender_name: USERNAME.to_string(),
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

    match community_canister_c2c_client::send_message(community_id.into(), &args).await {
        Ok(community_canister::send_message::Response::Success(_)) => (),
        Ok(resp) => {
            error!(?args, ?resp, "Failed to send lottery message");
        }
        Err(error) => {
            error!(?args, ?error, "Failed to send lottery message");
            mutate_state(|state| state.enqueue_pending_action(Action::SendMessage(Box::new(action)), None, true));
        }
    }
}
