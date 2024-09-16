use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    AccessGate, AccessGateConfig, Document, FieldTooLongResult, FieldTooShortResult, Milliseconds, OptionUpdate,
    OptionalGroupPermissions, UpdatedRules, Version,
};

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct Args {
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<UpdatedRules>,
    pub avatar: OptionUpdate<Document>,
    pub permissions_v2: Option<OptionalGroupPermissions>,
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub gate: OptionUpdate<AccessGate>,
    pub gate_config: OptionUpdate<AccessGateConfig>,
    pub public: Option<bool>,
    pub messages_visible_to_non_members: Option<bool>,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    SuccessV2(SuccessResult),
    NotAuthorized,
    CallerNotInGroup,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    RulesTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    AccessGateInvalid,
    NameTaken,
    UserSuspended,
    ChatFrozen,
    InternalError,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub rules_version: Option<Version>,
}
