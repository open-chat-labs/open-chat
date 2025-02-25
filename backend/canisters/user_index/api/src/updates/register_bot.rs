use candid::Principal;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotDefinition, BotInstallationLocation, UserId};

#[ts_export(user_index, register_bot)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
    pub owner: UserId,
    pub name: String,
    pub avatar: Option<String>, // Image as a data URL
    pub endpoint: String,
    pub definition: BotDefinition,
    pub initial_install_location: Option<BotInstallationLocation>,
}

#[ts_export(user_index, register_bot)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
