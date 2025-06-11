use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageIndex, PollVotes, VoteOperation};

#[ts_export(group, register_poll_vote)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub poll_option: u32,
    pub operation: VoteOperation,
    pub new_achievement: bool,
}

#[ts_export(group, register_poll_vote)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PollVotes),
    Error(OCError),
}
