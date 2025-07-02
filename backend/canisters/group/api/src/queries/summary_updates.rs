use candid::Principal;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{GroupCanisterGroupChatSummaryUpdates, TimestampMillis};

#[ts_export(group, summary_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    #[ts(skip)]
    pub on_behalf_of: Option<Principal>,
    pub updates_since: TimestampMillis,
}

#[ts_export(group, summary_updates)]
#[expect(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
    Error(OCError),
}

#[ts_export(group, summary_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub updates: GroupCanisterGroupChatSummaryUpdates,
}
