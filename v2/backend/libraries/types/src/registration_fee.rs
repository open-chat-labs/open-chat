use crate::{CanisterId, Cycles, TimestampMillis};
use candid::{CandidType, Principal};
use ic_ledger_types::{AccountIdentifier, Tokens};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(from = "Cycles")]
pub enum RegistrationFee {
    ICP(ICPRegistrationFee),
    Cycles(CyclesRegistrationFee),
}

impl RegistrationFee {
    pub fn valid_until(&self) -> TimestampMillis {
        match self {
            RegistrationFee::ICP(f) => f.valid_until,
            RegistrationFee::Cycles(f) => f.valid_until,
        }
    }
}

impl From<Cycles> for RegistrationFee {
    fn from(cycles: Cycles) -> Self {
        RegistrationFee::Cycles(CyclesRegistrationFee {
            amount: cycles,
            recipient: Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap(),
            valid_until: 0,
        })
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct ICPRegistrationFee {
    pub amount: Tokens,
    pub recipient: AccountIdentifier,
    pub valid_until: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CyclesRegistrationFee {
    pub amount: Cycles,
    pub recipient: CanisterId,
    pub valid_until: TimestampMillis,
}
