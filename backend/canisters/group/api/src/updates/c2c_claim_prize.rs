use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CompletedCryptoTransaction, DiamondMembershipStatus, FailedCryptoTransaction, MessageId, UserId};

#[ts_export(group, c2c_claim_prize)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
    pub is_unique_person: bool,
    pub diamond_status: DiamondMembershipStatus,
    pub total_chit_earned: u32,
}

#[ts_export(group, c2c_claim_prize)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
    Error(OCError),
}
