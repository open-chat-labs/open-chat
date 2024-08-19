use crate::Achievement;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum ReferralType {
    BtcMiami,
    User,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Copy, Default, TS)]
pub enum ReferralStatus {
    #[default]
    Registered,
    Diamond,
    UniquePerson,
    LifetimeDiamond,
}

impl ReferralStatus {
    pub fn chit_reward(&self) -> u32 {
        match self {
            ReferralStatus::Registered => 0,
            ReferralStatus::Diamond => Achievement::UpgradedToDiamond.chit_reward(),
            ReferralStatus::UniquePerson => Achievement::ProvedUniquePersonhood.chit_reward(),
            ReferralStatus::LifetimeDiamond => Achievement::UpgradedToGoldDiamond.chit_reward(),
        }
    }
}
