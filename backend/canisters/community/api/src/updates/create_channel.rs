use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    AccessGate, AccessRules, ChannelId, Document, FieldTooLongResult, FieldTooShortResult, GroupPermissions, GroupSubtype,
    Milliseconds,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: AccessRules,
    pub subtype: Option<GroupSubtype>,
    pub avatar: Option<Document>,
    pub history_visible_to_new_joiners: bool,
    pub permissions: Option<GroupPermissions>,
    pub events_ttl: Option<Milliseconds>,
    pub gate: Option<AccessGate>,
    pub is_default: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    RulesTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    MaxChannelsCreated(u32),
    NameTaken,
    UserSuspended,
    NotAuthorized,
    CommunityFrozen,
    DefaultMustBePublic,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub channel_id: ChannelId,
}
