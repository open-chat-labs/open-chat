use candid::CandidType;
use ic_ledger_types::BlockIndex;
use serde::Deserialize;
use types::PendingCryptocurrencyWithdrawal;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub withdrawal: PendingCryptocurrencyWithdrawal,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(BlockIndex),
    CurrencyNotSupported,
    TransactionFailed(String),
    InternalError(String),
}
