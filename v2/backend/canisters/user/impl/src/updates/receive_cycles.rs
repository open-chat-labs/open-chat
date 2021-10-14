use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use types::{Cycles, Timestamped};

#[update]
fn receive_cycles() {
    let cycles_available = ic_cdk::api::call::msg_cycles_available();
    let cycles_taken = ic_cdk::api::call::msg_cycles_accept(cycles_available);

    if cycles_taken > 0 {
        RUNTIME_STATE.with(|state| receive_cycles_impl(cycles_taken.into(), state.borrow_mut().as_mut().unwrap()));
    }
}

fn receive_cycles_impl(cycles: Cycles, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    let cycles_balance = runtime_state.data.cycles_balance.value + cycles;

    runtime_state.data.cycles_balance = Timestamped::new(cycles_balance, now);
}
