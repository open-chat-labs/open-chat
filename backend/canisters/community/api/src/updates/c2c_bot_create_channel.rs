use serde::{Deserialize, Serialize};
use types::{AccessGateConfig, BotInitiator, Document, GroupPermissions, Milliseconds, Rules, UserId};

use super::create_channel::{self, SuccessResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: Rules,
    pub avatar: Option<Document>,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: bool,
    pub permissions: Option<GroupPermissions>,
    pub events_ttl: Option<Milliseconds>,
    pub gate_config: Option<AccessGateConfig>,
    pub external_url: Option<String>,
}

impl From<Args> for create_channel::Args {
    fn from(value: Args) -> Self {
        create_channel::Args {
            is_public: value.is_public,
            name: value.name,
            description: value.description,
            rules: value.rules,
            subtype: None,
            avatar: value.avatar,
            history_visible_to_new_joiners: value.history_visible_to_new_joiners,
            messages_visible_to_non_members: Some(value.messages_visible_to_non_members),
            permissions_v2: value.permissions,
            events_ttl: value.events_ttl,
            gate_config: value.gate_config,
            external_url: value.external_url,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
    CommunityFrozen,
    InvalidRequest(String),
    InternalError(String),
}

impl From<create_channel::Response> for Response {
    fn from(value: create_channel::Response) -> Self {
        use Response::*;

        match value {
            create_channel::Response::Success(r) => Success(r),
            create_channel::Response::NameTooShort(r) => {
                InvalidRequest(format!("Name too short, min: {:?} chars", r.min_length))
            }
            create_channel::Response::NameTooLong(r) => InvalidRequest(format!("Name too long, max: {:?} chars", r.max_length)),
            create_channel::Response::NameReserved => InvalidRequest("Name reserved".to_string()),
            create_channel::Response::DescriptionTooLong(r) => {
                InvalidRequest(format!("Description too long, max: {:?} chars", r.max_length))
            }
            create_channel::Response::RulesTooShort(r) => {
                InvalidRequest(format!("Rules too short, min: {:?} chars", r.min_length))
            }
            create_channel::Response::RulesTooLong(r) => {
                InvalidRequest(format!("Rules too long, max: {:?} chars", r.max_length))
            }
            create_channel::Response::AvatarTooBig(r) => {
                InvalidRequest(format!("Avatar too big, max: {:?} bytes", r.max_length))
            }
            create_channel::Response::AccessGateInvalid => InvalidRequest("Access gate invalid".to_string()),
            create_channel::Response::MaxChannelsCreated(r) => InvalidRequest(format!("Max channels created: {:?}", r)),
            create_channel::Response::NameTaken => InvalidRequest("Name taken".to_string()),
            create_channel::Response::ExternalUrlInvalid => InvalidRequest("External URL invalid".to_string()),
            create_channel::Response::UserLapsed
            | create_channel::Response::UserSuspended
            | create_channel::Response::NotAuthorized => NotAuthorized,
            create_channel::Response::CommunityFrozen => CommunityFrozen,
            create_channel::Response::InternalError(r) => InternalError(r),
        }
    }
}
