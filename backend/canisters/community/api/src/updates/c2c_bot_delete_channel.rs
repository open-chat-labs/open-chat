use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{BotInitiator, ChannelId, UserId};

use super::delete_channel::{self};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: ChannelId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    CommunityFrozen,
    ChannelNotFound,
    Error(OCError),
}

impl From<delete_channel::Response> for Response {
    fn from(value: delete_channel::Response) -> Self {
        use Response::*;

        match value {
            delete_channel::Response::Success => Success,
            delete_channel::Response::CommunityFrozen => CommunityFrozen,
            delete_channel::Response::ChannelNotFound => ChannelNotFound,
            delete_channel::Response::Error(error) => Error(error),
            delete_channel::Response::UserSuspended
            | delete_channel::Response::UserNotInCommunity
            | delete_channel::Response::UserNotInChannel
            | delete_channel::Response::UserLapsed
            | delete_channel::Response::NotAuthorized => NotAuthorized,
        }
    }
}
