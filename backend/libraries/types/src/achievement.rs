use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Hash)]
pub enum Achievement {
    JoinedGroup,
    JoinedCommunity,
    SentDirectMessage,
    ReceivedDirectMessage,
    SetAvatar,
    SetBio,
    SetDisplayName,
    UpgradedToDiamond,
    UpgradedToGoldDiamond,
    Streak3,
    Streak7,
    Streak14,
    Streak30,
}

impl Achievement {
    pub fn chit_reward(&self) -> u32 {
        match self {
            Achievement::JoinedGroup => 500,
            Achievement::JoinedCommunity => 500,
            Achievement::SentDirectMessage => 700,
            Achievement::ReceivedDirectMessage => 1000,
            Achievement::SetAvatar => 1000,
            Achievement::SetBio => 1000,
            Achievement::SetDisplayName => 500,
            Achievement::UpgradedToDiamond => 5000,
            Achievement::UpgradedToGoldDiamond => 15000,
            Achievement::Streak3 => 1000,
            Achievement::Streak7 => 3000,
            Achievement::Streak14 => 5000,
            Achievement::Streak30 => 10000,
        }
    }
}
