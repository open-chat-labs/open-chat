use crate::create_channel;
use serde::{Deserialize, Serialize};
use types::{AccessGateConfig, BotInitiator, Document, GroupPermissions, Milliseconds, Rules, UserId};

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

pub type Response = create_channel::Response;
