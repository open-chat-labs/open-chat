use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageIndex, PollVotes, VoteOperation};

#[ts_export(community, register_poll_vote)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub poll_option: u32,
    pub operation: VoteOperation,
    pub new_achievement: bool,
}

#[ts_export(community, register_poll_vote)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PollVotes),
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    UserNotInChannel,
    UserCannotChangeVote,
    PollNotFound,
    PollEnded,
    OptionIndexOutOfRange,
    UserLapsed,
}
