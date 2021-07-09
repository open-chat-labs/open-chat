use candid::CandidType;
use serde::Deserialize;
use shared::types::reply_details::{PrivateReplyDetails, ReplyDetails};

#[derive(CandidType, Deserialize, Clone)]
pub enum ReplyContext {
    Reply(ReplyDetails),
    PrivateReply(PrivateReplyDetails),
}
