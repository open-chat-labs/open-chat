use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, CommunityId, CompletedCryptoTransaction, FailedCryptoTransaction, MessageId};

#[ts_export(local_user_index, claim_channel_prize)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub message_id: MessageId,
}

#[ts_export(local_user_index, join_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
    Error(OCError),
}
