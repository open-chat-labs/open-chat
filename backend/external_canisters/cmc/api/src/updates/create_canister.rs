use crate::notify_top_up::CanisterId;
use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

// Creates a canister on the chosen subnet, paid for with the cycles attached to the call, with the
// caller as its controller (the CMC's optional `settings` and deprecated `subnet_type` are left out)
#[derive(CandidType)]
pub struct Args {
    pub subnet_selection: Option<SubnetSelection>,
}

#[derive(CandidType)]
pub enum SubnetSelection {
    Subnet(Subnet),
}

#[derive(CandidType)]
pub struct Subnet {
    pub subnet: Principal,
}

pub type Response = Result<CanisterId, CreateCanisterError>;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum CreateCanisterError {
    // The cycles were returned to the caller, less a small fee
    Refunded { refund_amount: u128, create_error: String },
}
