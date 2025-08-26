use candid::Principal;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotDefinition, BotInstallationLocation, UserId};

#[ts_export(user_index, register_bot)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
    pub name: String,
    pub avatar: Option<String>, // Image as a data URL
    pub endpoint: String,
    pub definition: BotDefinition,
    pub permitted_install_location: Option<BotInstallationLocation>,
}

#[ts_export(user_index, register_bot)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyRegistered,
    InvalidRequest(String),
    InternalError(String),
    UserSuspended,
    Error(OCError),
}

#[ts_export(user_index, register_bot)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub bot_id: UserId,
}
