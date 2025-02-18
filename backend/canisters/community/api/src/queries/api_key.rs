use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UserId};

#[ts_export(community, api_key)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub channel_id: Option<ChannelId>,
}

#[ts_export(community, api_key)]
#[allow(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    NotAuthorized,
    NotFound,
    ChannelNotFound,
    CommunityFrozen,
}

impl From<Response> for types::c2c_bot_api_key::Response {
    fn from(value: Response) -> Self {
        match value {
            Response::Success(s) => types::c2c_bot_api_key::Response::Success(s),
            Response::CommunityFrozen => types::c2c_bot_api_key::Response::Frozen,
            Response::NotAuthorized => types::c2c_bot_api_key::Response::NotAuthorized,
            Response::NotFound => types::c2c_bot_api_key::Response::NotFound,
            Response::ChannelNotFound => types::c2c_bot_api_key::Response::NotFound,
        }
    }
}
