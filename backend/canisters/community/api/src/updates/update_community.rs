use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AccessGateConfig, Document, OptionUpdate, OptionalCommunityPermissions, UpdatedRules, Version};

#[ts_export(community, update_community)]
#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Args {
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<UpdatedRules>,
    #[ts(as = "types::OptionUpdateDocument")]
    pub avatar: OptionUpdate<Document>,
    #[ts(as = "types::OptionUpdateDocument")]
    pub banner: OptionUpdate<Document>,
    pub permissions: Option<OptionalCommunityPermissions>,
    #[ts(as = "types::OptionUpdateAccessGateConfig")]
    pub gate_config: OptionUpdate<AccessGateConfig>,
    pub public: Option<bool>,
    pub primary_language: Option<String>,
}

#[ts_export(community, update_community)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    SuccessV2(SuccessResult),
    Error(OCError),
}

#[ts_export(community, update_community)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub rules_version: Option<Version>,
}
