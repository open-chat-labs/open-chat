use crate::lifecycle::init_state;
use crate::{Data, StateVersion};
use ic_cdk_macros::post_upgrade;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
fn post_upgrade() {
    ic_cdk::setup();

    let (version, bytes): (StateVersion, Vec<u8>) = ic_cdk::storage::stable_restore().unwrap();
    let env = Box::new(CanisterEnv::new(false));

    let data: Data = match version {
        StateVersion::V1 => candid::decode_one(&bytes).unwrap(),
    };

    init_state(env, data);
}
