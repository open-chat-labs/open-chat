use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

use crate::{CompletedCryptoTransaction, FailedCryptoTransaction};

#[ts_export]
#[derive(Serialize, Deserialize, Debug)]
pub enum PrizeClaimResponse {
    Success,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
    Error(OCError),
}
