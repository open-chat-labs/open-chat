use crate::state;
use crate::state::State;
use candid::CandidType;
use ic_cdk::init;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct InitOrUpgradeArgs {
    pub oc_public_key: String,
    pub test_mode: bool,
}

#[init]
fn init(args: InitOrUpgradeArgs) {
    state::init(State::new(args.oc_public_key, args.test_mode));
}
