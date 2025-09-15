use serde::{Deserialize, Serialize};
use ts_export::ts_export;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
use oc_error_codes::OCError;
pub use queries::*;
use types::{BotDefinitionUpdate, UserId};
pub use updates::*;

#[ts_export(community)]
#[derive(Serialize, Deserialize, Debug)]
pub enum EventsResponse {
    Success(types::EventsResponse),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum LocalIndexEvent {
    NameChanged(NameChanged),
    VerifiedChanged(VerifiedChanged),
    UserDeleted(UserId),
    BotUpdated(BotDefinitionUpdate),
    BotRemoved(UserId),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NameChanged {
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VerifiedChanged {
    pub verified: bool,
}
