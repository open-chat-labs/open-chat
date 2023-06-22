use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageIndex, PollVotes, VoteOperation};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub poll_option: u32,
    pub operation: VoteOperation,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PollVotes),
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    UserNotInChannel,
    PollNotFound,
    PollEnded,
    OptionIndexOutOfRange,
}
