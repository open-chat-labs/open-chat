use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{BotInitiator, ChannelId, MemberType, MembersResponse, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: Option<ChannelId>,
    pub member_types: HashSet<MemberType>,
}

pub type Response = MembersResponse;
