use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, CompletedCryptoTransaction, FailedCryptoTransaction, MessageId};

#[ts_export(community, claim_prize)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
}

#[ts_export(community, claim_prize)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
    Error(OCError),
}
