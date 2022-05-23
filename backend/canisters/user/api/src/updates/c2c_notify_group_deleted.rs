use candid::CandidType;
use serde::Deserialize;
use types::DeletedGroupInfo;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub deleted_group: DeletedGroupInfo,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
