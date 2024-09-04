use candid::CandidType;
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(user, get_cached_btc_address)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(String),
    NotFound,
}
