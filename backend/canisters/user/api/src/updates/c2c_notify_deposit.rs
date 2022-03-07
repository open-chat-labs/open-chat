use candid::CandidType;
use serde::Deserialize;
use types::CryptocurrencyDeposit;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub deposit: CryptocurrencyDeposit,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
