use candid::CandidType;
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
    pub correlation_id: u64,
}

#[ts_export(group, register_poll_vote)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PollVotes),
    PollNotFound,
    PollEnded,
    OptionIndexOutOfRange,
    UserCannotChangeVote,
    CallerNotInGroup,
    UserSuspended,
    UserLapsed,
    ChatFrozen,
}
