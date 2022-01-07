use crate::{CanisterId, Cycles, TimestampMillis, ICP};
use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct ICPRegistrationFee {
    pub amount: ICP,
    pub recipient: AccountIdentifier,
    pub valid_until: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CyclesRegistrationFee {
    pub amount: Cycles,
    pub recipient: CanisterId,
    pub valid_until: TimestampMillis,
}
