use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use cycles_utils::accept_cycles;
use ic_cdk_macros::update;
use types::{AlertDetails, CompletedCyclesDeposit, CryptocurrencyDeposit, Cycles, CyclesDeposit};

#[update]
#[trace]
fn wallet_receive() {
    run_regular_jobs();

    let cycles_accepted = accept_cycles();
    if cycles_accepted > 0 {
        RUNTIME_STATE.with(|state| store_cycles_deposit(cycles_accepted, state.borrow_mut().as_mut().unwrap()));
    }
}

fn store_cycles_deposit(cycles: Cycles, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    let from = runtime_state.env.caller();

    let deposit = CryptocurrencyDeposit::Cycles(CyclesDeposit::Completed(CompletedCyclesDeposit { from, cycles }));

    runtime_state.data.user_cycles_balance.add(cycles, now);
    runtime_state.data.transactions.add(deposit.clone(), now);
    runtime_state
        .data
        .alerts
        .add(AlertDetails::CryptocurrencyDepositReceived(deposit), now);
}
