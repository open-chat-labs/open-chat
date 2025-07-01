use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    AccessGateConfig, ChannelId, Document, Milliseconds, OptionUpdate, OptionalGroupPermissions, UpdatedRules, Version,
};

#[ts_export(community, update_channel)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<UpdatedRules>,
    #[ts(as = "types::OptionUpdateDocument")]
    pub avatar: OptionUpdate<Document>,
    pub permissions_v2: Option<OptionalGroupPermissions>,
    #[ts(as = "types::OptionUpdateU64")]
    pub events_ttl: OptionUpdate<Milliseconds>,
    #[ts(as = "types::OptionUpdateAccessGateConfig")]
    pub gate_config: OptionUpdate<AccessGateConfig>,
    pub public: Option<bool>,
    pub messages_visible_to_non_members: Option<bool>,
    #[ts(as = "types::OptionUpdateString")]
    pub external_url: OptionUpdate<String>,
}

#[ts_export(community, update_channel)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    SuccessV2(SuccessResult),
    Error(OCError),
}

#[ts_export(community, update_channel)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub rules_version: Option<Version>,
}
