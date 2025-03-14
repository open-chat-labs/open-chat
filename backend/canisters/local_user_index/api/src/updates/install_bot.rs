use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotInstallationLocation, BotPermissions, UserId};

#[ts_export(local_user_index, install_bot)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub location: BotInstallationLocation,
    pub bot_id: UserId,
    pub granted_permissions: BotPermissions,
}

#[ts_export(local_user_index, install_bot)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Frozen,
    NotAuthorized,
    AlreadyAdded,
    NotFound,
    InternalError(String),
    Error(OCError),
}

impl From<types::c2c_install_bot::Response> for Response {
    fn from(response: types::c2c_install_bot::Response) -> Self {
        match response {
            types::c2c_install_bot::Response::Success => Response::Success,
            types::c2c_install_bot::Response::Error(error) => Response::Error(error),
            types::c2c_install_bot::Response::Frozen => Response::Frozen,
            types::c2c_install_bot::Response::NotAuthorized => Response::NotAuthorized,
            types::c2c_install_bot::Response::AlreadyAdded => Response::AlreadyAdded,
        }
    }
}
