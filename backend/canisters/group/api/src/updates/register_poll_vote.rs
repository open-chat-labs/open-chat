use candid::CandidType;
use serde::Deserialize;
use types::{MessageIndex, PollVotes, VoteOperation};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
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
    CallerNotInGroup,
}
