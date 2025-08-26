use candid::{CandidType, Principal};

#[derive(CandidType)]
pub struct Args {
    pub who: Option<Principal>,
    pub subnets: Vec<Principal>,
}

pub type Response = ();
