use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{BotConfig, Cycles};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub username: String,
    pub display_name: Option<String>,
    pub config: OptionalBotConfig,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyRegistered,
    UserLimitReached,
    UsernameTaken,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
    DisplayNameInvalid,
    DisplayNameTooShort(u16),
    DisplayNameTooLong(u16),
    InsufficientCyclesProvided(Cycles),
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct OptionalBotConfig {
    pub supports_direct_messages: Option<bool>,
    pub can_be_added_to_groups: Option<bool>,
}

impl From<OptionalBotConfig> for BotConfig {
    fn from(value: OptionalBotConfig) -> Self {
        BotConfig {
            is_oc_controlled: false,
            supports_direct_messages: value.supports_direct_messages.unwrap_or_default(),
            can_be_added_to_groups: value.can_be_added_to_groups.unwrap_or_default(),
        }
    }
}
