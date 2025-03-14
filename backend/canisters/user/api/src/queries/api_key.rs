use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(user, api_key)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
}

#[ts_export(user, api_key)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    NotAuthorized,
    NotFound,
    Error(OCError),
}

impl From<Response> for types::c2c_bot_api_key::Response {
    fn from(value: Response) -> Self {
        match value {
            Response::Success(s) => types::c2c_bot_api_key::Response::Success(s),
            Response::Error(error) => types::c2c_bot_api_key::Response::Error(error),
            Response::NotAuthorized => types::c2c_bot_api_key::Response::NotAuthorized,
            Response::NotFound => types::c2c_bot_api_key::Response::NotFound,
        }
    }
}
