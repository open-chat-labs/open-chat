use candid::CandidType;
use ic_ledger_types::BlockIndex;
use serde::{Deserialize, Serialize};
use types::{ICP, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
pub struct AccountBilling {
    #[serde(rename = "c", alias = "charges")]
    charges: Vec<AccountCharge>,
}

impl AccountBilling {
    pub fn is_empty(&self) -> bool {
        self.charges.is_empty()
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct AccountCharge {
    pub amount: ICP,
    pub timestamp: TimestampMillis,
    pub block_index: BlockIndex,
    pub details: AccountChargeDetails,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum AccountChargeDetails {
    Storage(StorageAccountChargeDetails),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct StorageAccountChargeDetails {
    pub old_bytes_limit: u64,
    pub new_bytes_limit: u64,
}
