use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageIndex, PollVotes, UserId, VoteOperation};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_index: MessageIndex,
    pub poll_option: u32,
    pub operation: VoteOperation,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PollVotes),
    PollNotFound,
    PollEnded,
    OptionIndexOutOfRange,
    ChatNotFound,
}
