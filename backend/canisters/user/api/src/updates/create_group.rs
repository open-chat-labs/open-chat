use candid::CandidType;
use ts_export::ts_export;
use types::{AccessGate, ChatId, Document, FieldTooLongResult, FieldTooShortResult, GroupPermissions, Milliseconds, Rules};

#[ts_export(user, create_group)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: Rules,
    pub avatar: Option<Document>,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: Option<bool>,
    pub permissions_v2: Option<GroupPermissions>,
    pub events_ttl: Option<Milliseconds>,
    pub gate: Option<AccessGate>,
}

#[ts_export(user, create_group)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    RulesTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    AccessGateInvalid,
    MaxGroupsCreated(u32),
    NameTaken,
    Throttled,
    UserSuspended,
    UnauthorizedToCreatePublicGroup,
    InternalError,
}

#[ts_export(user, create_group)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
}
