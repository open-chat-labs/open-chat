use candid::CandidType;
use serde::Deserialize;
use types::{MessageIndex, PollVotes, UserId, VoteOperation};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_index: MessageIndex,
    pub poll_option: u32,
    pub operation: VoteOperation,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(PollVotes),
    PollNotFound,
    PollEnded,
    OptionIndexOutOfRange,
    ChatNotFound,
}
