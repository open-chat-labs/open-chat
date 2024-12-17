use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{OptionUpdate, UserId};

#[ts_export(user_index, update_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub owner: Option<UserId>,
    pub name: Option<String>,
    #[ts(as = "types::OptionUpdateString")]
    pub avatar: OptionUpdate<String>, // Image as a data URL
    pub endpoint: Option<String>,
}

#[ts_export(user_index, update_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NameInvalid,
    NameAlreadyExists,
    AvatarInvalid,
    EndpointInvalid,
    BotNotFound,
    BotSuspended,
    NotAuthorised,
    OwnerNotFound,
    OwnerSuspended,
    NewOwnerNotFound,
    NewOwnerSuspended,
    DefinitionNotFound,
    DefinitionInvalid,
    DescriptionTooLong,
    TooManyCommands,
}
