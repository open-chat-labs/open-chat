use candid::CandidType;
use ts_export::ts_export;

#[ts_export(user, retrieve_btc)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub amount: u64,
    pub address: String,
}

#[ts_export(user, retrieve_btc)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(u64), // The block index of the ckBTC burn transaction
    ApproveError(String),
    RetrieveBtcError(String),
    InternalError(String),
}
