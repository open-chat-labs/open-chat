use crate::{RuntimeState, RUNTIME_STATE, STATE_VERSION};
use ic_cdk_macros::pre_upgrade;

#[pre_upgrade]
fn pre_upgrade() {
    RUNTIME_STATE.with(|state| pre_upgrade_impl(state.borrow().as_ref().unwrap()));
}

fn pre_upgrade_impl(runtime_state: &RuntimeState) {
    let data_bytes = candid::encode_one(&runtime_state.data).unwrap();
    ic_cdk::storage::stable_save((STATE_VERSION, data_bytes)).unwrap();
}
