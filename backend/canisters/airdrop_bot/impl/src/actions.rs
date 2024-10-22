use crate::jobs::execute_airdrop::start_airdrop_timer;
use crate::{mutate_state, read_state, USERNAME};
use candid::Deserialize;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use rand::Rng;
use serde::Serialize;
use timer_job_queues::TimerJobItem;
use tracing::{error, info, trace};
use types::icrc1::{self, Account};
use types::{
    BotMessage, CanisterId, ChannelId, CommunityId, CompletedCryptoTransaction, CryptoContent, CryptoTransaction,
    Cryptocurrency, MessageContentInitial, UserId,
};
use utils::canister::should_retry_failed_c2c_call;
use utils::consts::{MEMO_CHIT_FOR_CHAT_AIRDROP, MEMO_CHIT_FOR_CHAT_LOTTERY};
use utils::time::{MonthKey, MONTHS};

impl TimerJobItem for Action {
    async fn process(&self) -> Result<(), bool> {
        match self.clone() {
            Action::JoinChannel(community_id, channel_id) => join_channel(community_id, channel_id).await,
            Action::SendMessage(a) if matches!(a.airdrop_type, AirdropType::Lottery(_)) => {
                handle_lottery_message_action(*a).await
            }
            Action::SendMessage(a) => handle_main_message_action(*a).await,
            Action::Transfer(a) => handle_transfer_action(*a).await,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Action {
    JoinChannel(CommunityId, ChannelId),
    Transfer(Box<AirdropTransfer>),
    SendMessage(Box<AirdropMessage>),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AirdropTransfer {
    pub recipient: UserId,
    pub amount: u128,
    pub airdrop_type: AirdropType,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AirdropMessage {
    pub recipient: UserId,
    pub transaction: CompletedCryptoTransaction,
    pub airdrop_type: AirdropType,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum AirdropType {
    Main(MainAirdrop),
    Lottery(LotteryAirdrop),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MainAirdrop {
    pub chit: u32,
    pub shares: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LotteryAirdrop {
    pub position: usize,
}

async fn join_channel(community_id: CommunityId, channel_id: ChannelId) -> Result<(), bool> {
    info!(?community_id, ?channel_id, "Join channel");

    let local_user_index_canister_id = match community_canister_c2c_client::local_user_index(
        community_id.into(),
        &community_canister::local_user_index::Args {},
    )
    .await
    {
        Ok(community_canister::local_user_index::Response::Success(canister_id)) => canister_id,
        Err((code, msg)) => {
            let retry = should_retry_failed_c2c_call(code, &msg);
            return Err(retry);
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
            return Err(true);
        }
        Ok(resp) => {
            error!("Failed to join_channel {resp:?}");
            return Err(false);
        }
        Err(err) => {
            error!("Failed to join_channel {err:?}");
            return Err(true);
        }
    }

    mutate_state(|state| {
        state.data.channels_joined.insert((community_id, channel_id));
        start_airdrop_timer(state);
    });
    Ok(())
}

async fn handle_transfer_action(action: AirdropTransfer) -> Result<(), bool> {
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
            return Err(true);
        }
    }

    Ok(())
}

async fn handle_main_message_action(action: AirdropMessage) -> Result<(), bool> {
    trace!("Send DM");

    let AirdropType::Main(MainAirdrop { chit, shares }) = action.airdrop_type else {
        return Ok(());
    };

    let Some(month) = read_state(|state| {
        state.data.airdrops.current(state.env.now()).map(|c| {
            let mk = MonthKey::from_timestamp(c.start).previous();
            MONTHS[mk.month() as usize - 1]
        })
    }) else {
        return Ok(());
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
        Ok(user_canister::c2c_handle_bot_messages::Response::Success) => Ok(()),
        Ok(resp) => {
            error!(?args, ?resp, "Failed to send DM");
            Err(false)
        }
        Err((code, msg)) => {
            let retry = should_retry_failed_c2c_call(code, &msg);
            error!(?args, ?code, msg, "Failed to send DM");
            Err(retry)
        }
    }
}

async fn handle_lottery_message_action(action: AirdropMessage) -> Result<(), bool> {
    info!("Send lottery winners message");

    let AirdropType::Lottery(LotteryAirdrop { position }): AirdropType = action.airdrop_type else {
        return Err(false);
    };

    let Some((community_id, channel_id, message_id)) = mutate_state(|state| {
        state
            .data
            .airdrops
            .current(state.env.now())
            .map(|c| (c.community_id, c.channel_id, state.env.rng().gen()))
    }) else {
        return Err(false);
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
        Ok(community_canister::send_message::Response::Success(_)) => Ok(()),
        Ok(resp) => {
            error!(?args, ?resp, "Failed to send lottery message");
            Err(false)
        }
        Err((code, msg)) => {
            error!(?args, ?code, msg, "Failed to send lottery message");
            let retry = should_retry_failed_c2c_call(code, &msg);
            Err(retry)
        }
    }
}
