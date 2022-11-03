use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageIndex, PollVotes, VoteOperation};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub poll_option: u32,
    pub operation: VoteOperation,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PollVotes),
    PollNotFound,
    PollEnded,
    OptionIndexOutOfRange,
    CallerNotInGroup,
    ChatFrozen,
}
