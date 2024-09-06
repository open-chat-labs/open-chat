use candid::CandidType;
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(user_index, create_challenge)]
#[derive(CandidType, Debug)]
pub enum Response {
    NotRequired,
}
