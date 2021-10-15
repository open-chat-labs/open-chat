use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use types::{Cycles, Timestamped};

#[update]
fn wallet_receive() {
    receive_cycles();
}

#[update]
fn receive_cycles() {
    run_regular_jobs();

    let cycles_available = ic_cdk::api::call::msg_cycles_available();
    let cycles_taken = ic_cdk::api::call::msg_cycles_accept(cycles_available);

    if cycles_taken > 0 {
        RUNTIME_STATE.with(|state| receive_cycles_impl(cycles_taken.into(), state.borrow_mut().as_mut().unwrap()));
    }
}

fn receive_cycles_impl(cycles: Cycles, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    let new_cycles_balance = runtime_state.data.user_cycles_balance.value + cycles;

    runtime_state.data.user_cycles_balance = Timestamped::new(new_cycles_balance, now);
}
