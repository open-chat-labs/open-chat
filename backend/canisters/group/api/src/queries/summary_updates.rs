use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{GroupCanisterGroupChatSummaryUpdates, TimestampMillis};

#[ts_export(group, summary_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[ts(skip)]
    pub on_behalf_of: Option<Principal>,
    pub updates_since: TimestampMillis,
}

#[ts_export(group, summary_updates)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
    CallerNotInGroup,
}

#[ts_export(group, summary_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub updates: GroupCanisterGroupChatSummaryUpdates,
}
