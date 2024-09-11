use candid::CandidType;
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(user_index, public_key)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(String),
    NotInitialised,
}
