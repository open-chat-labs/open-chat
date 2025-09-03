use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CompletedCryptoTransaction, PendingCryptoTransaction, PinNumberWrapper};

#[ts_export(user, withdraw_crypto)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub withdrawal: PendingCryptoTransaction,
    pub pin: Option<PinNumberWrapper>,
}

#[ts_export(user, withdraw_crypto)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<CompletedCryptoTransaction>),
    Error(OCError),
}
