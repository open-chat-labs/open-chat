use crate::notify_top_up::CanisterId;
use crate::NotifyError;
use candid::{CandidType, Principal};

#[derive(CandidType)]
pub struct Args {
    pub block_index: u64,
    pub controller: Principal,
    pub subnet_selection: Option<SubnetSelection>,
}

pub type Response = Result<CanisterId, NotifyError>;

#[derive(CandidType)]
pub enum SubnetSelection {
    Subnet(Subnet),
}

#[derive(CandidType)]
pub struct Subnet {
    pub subnet: Principal,
}
