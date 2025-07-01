use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{SelectedGroupUpdates, TimestampMillis};

#[ts_export(group, selected_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[ts_export(group, selected_updates)]
#[expect(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SelectedGroupUpdates),
    SuccessNoUpdates(TimestampMillis),
    Error(OCError),
}
