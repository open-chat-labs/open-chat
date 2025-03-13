use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    AccessGateConfig, Document, FieldTooLongResult, FieldTooShortResult, OptionUpdate, OptionalCommunityPermissions,
    UpdatedRules, Version,
};

#[ts_export(community, update_community)]
#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
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
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    SuccessV2(SuccessResult),
    NotAuthorized,
    UserNotInCommunity,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    BannerTooBig(FieldTooLongResult),
    AccessGateInvalid,
    NameTaken,
    InternalError,
    RulesTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    UserSuspended,
    CommunityFrozen,
    InvalidLanguage,
    UserLapsed,
    Error(u16, Option<String>),
}

#[ts_export(community, update_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub rules_version: Option<Version>,
}
