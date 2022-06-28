use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, MessageId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub adopt: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyVoted(SuccessResult),
    CallerNotInGroup,
    ProposalNotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub adopt_votes: u32,
    pub reject_votes: u32,
    pub my_vote: bool,
    pub latest_event_index: EventIndex,
}
