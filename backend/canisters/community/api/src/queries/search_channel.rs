use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use ts_export::ts_export;
use types::{ChannelId, MessageMatch, UserId};

#[ts_export(community, search_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub search_term: String,
    pub max_results: u8,
    pub users: Option<HashSet<UserId>>,
}

#[ts_export(community, search_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InvalidTerm,
    TermTooLong(u8),
    TermTooShort(u8),
    TooManyUsers(u8),
    UserNotInCommunity,
    ChannelNotFound,
    UserNotInChannel,
    Error(u16, Option<String>),
}

#[ts_export(community, search_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub matches: Vec<MessageMatch>,
}
