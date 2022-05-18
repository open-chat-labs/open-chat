use crate::{ChatId, CryptocurrencyDeposit, Milliseconds, UserId};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::str::FromStr;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Alert {
    pub id: String,
    pub elapsed: Milliseconds,
    pub details: AlertDetails,
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
    #[serde(default)]
    pub group_name: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupDeleted {
    pub chat_id: ChatId,
    pub deleted_by: UserId,
    #[serde(default)]
    pub group_name: String,
}

pub enum AlertId {
    Internal(u32),
    GroupDeleted(ChatId),
}

impl FromStr for AlertId {
    type Err = ();

    fn from_str(ext_id: &str) -> Result<Self, Self::Err> {
        let mut ext_id = ext_id.to_owned();
        if ext_id.starts_with("in_") {
            ext_id.replace_range(0..3, "");
            ext_id.parse::<u32>().map(AlertId::Internal).map_err(|_| ())
        } else if ext_id.starts_with("gd_") {
            ext_id.replace_range(0..3, "");
            Principal::from_text(&ext_id)
                .map(|id| AlertId::GroupDeleted(id.into()))
                .map_err(|_| ())
        } else {
            Err(())
        }
    }
}

impl Display for AlertId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let ext_id = match self {
            AlertId::Internal(id) => format!("in_{id}"),
            AlertId::GroupDeleted(chat_id) => format!("gd_{chat_id}"),
        };

        f.write_str(&ext_id)
    }
}
