use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, MessageIndex, MultiUserChat, UserId};

use crate::c2c_report_message;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub chat_id: MultiUserChat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub reason_code: u32,
    pub notes: Option<String>,
}

pub type Response = c2c_report_message::Response;
