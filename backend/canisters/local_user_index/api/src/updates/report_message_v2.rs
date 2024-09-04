use candid::CandidType;
use ts_export::ts_export;
use types::{EventIndex, MessageIndex, MultiUserChat};

#[ts_export(local_user_index, report_message_v2)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub chat_id: MultiUserChat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub reason_code: u32,
    pub notes: Option<String>,
}

#[ts_export(local_user_index, report_message_v2)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    InternalError(String),
}
