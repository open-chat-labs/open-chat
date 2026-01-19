use serde::{Deserialize, Serialize};
use types::{ChannelId, DiamondMembershipStatus, MessageId, PrizeClaimResponse, TimestampMillis, UserId};

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
    pub user_reauthenticated: bool,
}

// this is needed so that the generate_c2c_call macro doesn't complain
pub type Response = PrizeClaimResponse;
