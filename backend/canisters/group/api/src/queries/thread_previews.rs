use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageIndex, ThreadPreview, TimestampMillis};

#[ts_export(group, thread_previews)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub threads: Vec<MessageIndex>,
    pub latest_client_thread_update: Option<TimestampMillis>,
}

#[ts_export(group, thread_previews)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(group, thread_previews)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub threads: Vec<ThreadPreview>,
    pub timestamp: TimestampMillis,
}
