use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    AccessGate, Document, FieldTooLongResult, FieldTooShortResult, OptionUpdate, OptionalCommunityPermissions, UpdatedRules,
    Version,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<UpdatedRules>,
    pub avatar: OptionUpdate<Document>,
    pub banner: OptionUpdate<Document>,
    pub permissions: Option<OptionalCommunityPermissions>,
    pub gate: OptionUpdate<AccessGate>,
    pub public: Option<bool>,
    pub primary_language: Option<String>,
}

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
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub rules_version: Option<Version>,
}
