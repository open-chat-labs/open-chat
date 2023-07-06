use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    AccessGate, AccessRules, Document, FieldTooLongResult, FieldTooShortResult, OptionUpdate, OptionalCommunityPermissions,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<AccessRules>,
    pub avatar: OptionUpdate<Document>,
    pub banner: OptionUpdate<Document>,
    pub permissions: Option<OptionalCommunityPermissions>,
    pub gate: OptionUpdate<AccessGate>,
    pub public: Option<bool>,
    pub primary_language: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    UserNotInCommunity,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    BannerTooBig(FieldTooLongResult),
    NameTaken,
    InternalError,
    RulesTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    UserSuspended,
    CommunityFrozen,
    CannotMakeCommunityPublic,
    InvalidLanguage,
}
