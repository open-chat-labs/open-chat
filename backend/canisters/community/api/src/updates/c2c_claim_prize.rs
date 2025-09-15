use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{
    ChannelId, CompletedCryptoTransaction, DiamondMembershipStatus, FailedCryptoTransaction, MessageId, TimestampMillis, UserId,
};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub is_unique_person: bool,
    pub diamond_status: DiamondMembershipStatus,
    pub total_chit_earned: u32,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
    Error(OCError),
}
