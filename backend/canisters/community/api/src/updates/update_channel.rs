use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    AccessGate, ChannelId, Document, FieldTooLongResult, FieldTooShortResult, OptionUpdate, OptionalGroupPermissions, Rules,
    Version,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<Rules>,
    pub avatar: OptionUpdate<Document>,
    pub permissions: Option<OptionalGroupPermissions>,
    pub gate: OptionUpdate<AccessGate>,
    pub public: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessV2(SuccessResult),
    NotAuthorized,
    UserNotInCommunity,
    ChannelNotFound,
    UserNotInChannel,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    NameTaken,
    RulesTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    UserSuspended,
    CommunityFrozen,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub rules_version: Option<Version>,
}
