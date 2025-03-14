use candid::{CandidType, Principal};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotDefinition, OptionUpdate, UserId};

#[ts_export(user_index, update_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub owner: Option<UserId>,
    #[ts(as = "Option::<ts_export::TSPrincipal>")]
    pub principal: Option<Principal>,
    #[ts(as = "types::OptionUpdateString")]
    pub avatar: OptionUpdate<String>, // Image as a data URL
    pub endpoint: Option<String>,
    pub definition: Option<BotDefinition>,
}

#[ts_export(user_index, update_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PrincipalInvalid,
    PrincipalAlreadyUsed,
    AvatarInvalid,
    EndpointInvalid,
    BotNotFound,
    BotSuspended,
    NotAuthorised,
    OwnerNotFound,
    OwnerSuspended,
    NewOwnerNotFound,
    NewOwnerSuspended,
    DescriptionTooLong,
    TooManyCommands,
    Error(OCError),
}
