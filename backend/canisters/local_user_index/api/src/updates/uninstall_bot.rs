use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotInstallationLocation, UserId};

#[ts_export(local_user_index, remove_bot)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub location: BotInstallationLocation,
    pub bot_id: UserId,
}

#[ts_export(local_user_index, remove_bot)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    InternalError(String),
}

impl From<types::c2c_uninstall_bot::Response> for Response {
    fn from(response: types::c2c_uninstall_bot::Response) -> Self {
        match response {
            types::c2c_uninstall_bot::Response::Success => Response::Success,
            types::c2c_uninstall_bot::Response::NotAuthorized => Response::NotAuthorized,
        }
    }
}
