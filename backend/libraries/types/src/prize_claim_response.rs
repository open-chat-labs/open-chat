use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};

use crate::{CompletedCryptoTransaction, FailedCryptoTransaction};

#[derive(Serialize, Deserialize, Debug)]
pub enum PrizeClaimResponse {
    Success,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
    Error(OCError),
}
