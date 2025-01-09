use crate::state::State;
use crate::{rng, state};
use candid::{CandidType, Principal};
use ic_cdk::init;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct InitOrUpgradeArgs {
    pub oc_public_key: String,
    pub administrator: Principal,
}

#[init]
fn init(args: InitOrUpgradeArgs) {
    let state = State::new(args.oc_public_key, args.administrator);
    rng::init(state.rng_seed());
    state::init(state);
}
