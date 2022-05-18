use crate::{ChatId, CryptocurrencyDeposit, DeletedGroupInfo, Milliseconds, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::str::FromStr;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Alert {
    pub id: String,
    pub elapsed: Milliseconds,
    pub timestamp: TimestampMillis,
    pub details: AlertDetails,
    pub read: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum AlertDetails {
    RemovedFromGroup(RemovedFromGroup),
    BlockedFromGroup(RemovedFromGroup),
    GroupDeleted(GroupDeleted),
    CryptocurrencyDepositReceived(CryptocurrencyDeposit),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct RemovedFromGroup {
    pub chat_id: ChatId,
    pub removed_by: UserId,
    pub group_name: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupDeleted {
    pub chat_id: ChatId,
    pub deleted_by: UserId,
    pub group_name: String,
}

pub enum AlertId {
    Internal(u32),
    GroupDeleted(DeletedGroupInfo),
}

impl FromStr for AlertId {
    type Err = ();

    fn from_str(ext_id: &str) -> Result<Self, Self::Err> {
        match ext_id.split_at(3) {
            ("in_", id) => id.parse::<u32>().map(AlertId::Internal).map_err(|_| ()),
            ("gd_", base64) => base64::decode(base64)
                .map_err(|_| ())
                .and_then(|json| serde_json::from_slice(&json).map_err(|_| ()))
                .map(AlertId::GroupDeleted),
            _ => Err(()),
        }
    }
}

impl Display for AlertId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let ext_id = match self {
            AlertId::Internal(id) => format!("in_{id}"),
            AlertId::GroupDeleted(d) => format!("gd_{}", base64::encode(&serde_json::to_vec(&d).unwrap())),
        };

        f.write_str(&ext_id)
    }
}
