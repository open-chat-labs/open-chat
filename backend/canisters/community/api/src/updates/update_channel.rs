use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    Avatar, ChannelId, FieldTooLongResult, FieldTooShortResult, GroupGate, GroupRules, OptionUpdate, OptionalGroupPermissions,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<GroupRules>,
    pub avatar: OptionUpdate<Avatar>,
    pub permissions: Option<OptionalGroupPermissions>,
    pub gate: OptionUpdate<GroupGate>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
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
