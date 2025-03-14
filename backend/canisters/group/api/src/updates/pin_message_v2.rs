use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageIndex, PushEventResult};

#[ts_export(group, pin_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_index: MessageIndex,
    pub correlation_id: u64,
}

#[ts_export(group, pin_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PushEventResult),
    NoChange,
    MessageIndexOutOfRange,
    NotAuthorized,
    CallerNotInGroup,
    MessageNotFound,
    UserSuspended,
    UserLapsed,
    ChatFrozen,
    Error(OCError),
}
