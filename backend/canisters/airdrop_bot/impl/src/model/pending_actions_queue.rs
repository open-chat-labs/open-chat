use serde::{Deserialize, Serialize};
use std::collections::vec_deque::VecDeque;
use types::{ChannelId, CommunityId, CompletedCryptoTransaction, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct PendingActionsQueue {
    queue: VecDeque<Action>,
}

impl PendingActionsQueue {
    pub fn push(&mut self, action: Action) {
        self.queue.push_back(action);
    }

    pub fn pop(&mut self) -> Option<Action> {
        self.queue.pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    pub fn len(&self) -> usize {
        self.queue.len()
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub enum Action {
    JoinChannel(CommunityId, ChannelId),
    Transfer(Box<AirdropTransfer>),
    SendMessage(Box<AirdropMessage>),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AirdropTransfer {
    pub recipient: UserId,
    pub amount: u128,
    pub airdrop_type: AirdropType,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AirdropMessage {
    pub recipient: UserId,
    pub transaction: CompletedCryptoTransaction,
    pub airdrop_type: AirdropType,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum AirdropType {
    Main(MainAidrop),
    Lottery(LotteryAirdrop),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MainAidrop {
    pub chit: u32,
    pub shares: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LotteryAirdrop {
    pub position: usize,
}
