use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    AccessGate, AccessRules, Document, FieldTooLongResult, FieldTooShortResult, Milliseconds, OptionUpdate,
    OptionalGroupPermissions,
};

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct Args {
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<AccessRules>,
    pub avatar: OptionUpdate<Document>,
    pub permissions: Option<OptionalGroupPermissions>,
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub gate: OptionUpdate<AccessGate>,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    CallerNotInGroup,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    RulesTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    NameTaken,
    UserSuspended,
    ChatFrozen,
    InternalError,
}
