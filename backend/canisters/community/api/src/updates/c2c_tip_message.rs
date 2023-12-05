use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, ChannelId, Cryptocurrency, MessageId, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token: Cryptocurrency,
    pub amount: u128,
    pub decimals: u8,
    pub username: String,
    pub display_name: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    CannotTipSelf,
    RecipientMismatch,
    NotAuthorized,
    CommunityFrozen,
    UserNotInCommunity,
    ChannelNotFound,
    UserSuspended,
}
