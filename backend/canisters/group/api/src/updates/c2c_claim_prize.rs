use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{DiamondMembershipStatus, MessageId, PrizeClaimResponse, TimestampMillis, UserId};

#[ts_export(group, c2c_claim_prize)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
    pub is_unique_person: bool,
    pub diamond_status: DiamondMembershipStatus,
    pub total_chit_earned: u32,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
}

// this is needed so that the generate_c2c_call macro doesn't complain
pub type Response = PrizeClaimResponse;
