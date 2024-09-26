use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    AccessGate, Document, FieldTooLongResult, FieldTooShortResult, Milliseconds, OptionUpdate, OptionalGroupPermissions,
    UpdatedRules, Version,
};

#[ts_export(group, update_group)]
#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct Args {
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<UpdatedRules>,
    #[ts(as = "types::OptionUpdateDocument")]
    pub avatar: OptionUpdate<Document>,
    pub permissions_v2: Option<OptionalGroupPermissions>,
    #[ts(as = "types::OptionUpdateU64")]
    pub events_ttl: OptionUpdate<Milliseconds>,
    #[ts(as = "types::OptionUpdateAccessGate")]
    pub gate: OptionUpdate<AccessGate>,
    pub public: Option<bool>,
    pub messages_visible_to_non_members: Option<bool>,
    pub correlation_id: u64,
}

#[ts_export(group, update_group)]
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

#[ts_export(group, update_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub rules_version: Option<Version>,
}
