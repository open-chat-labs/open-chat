use crate::{BotPermissions, BotSubscriptions, UnitResult, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub granted_permissions: BotPermissions,
    pub granted_autonomous_permissions: Option<BotPermissions>,
    pub default_subscriptions: Option<BotSubscriptions>,
}

pub type Response = UnitResult;
