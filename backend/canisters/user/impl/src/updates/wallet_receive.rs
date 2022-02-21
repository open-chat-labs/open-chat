use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::{AlertDetails, CompletedCyclesDeposit, CryptocurrencyDeposit, Cycles, CyclesDeposit};
use utils::cycles::accept_cycles;

#[update]
#[trace]
fn wallet_receive() {
    run_regular_jobs();

    let cycles_accepted = accept_cycles();
    if cycles_accepted > 0 {
        mutate_state(|state| store_cycles_deposit(cycles_accepted, state));
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
