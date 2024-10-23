use crate::{mutate_state, read_state, RuntimeState, GROUP_CANISTER_INITIAL_CYCLES_BALANCE};
use ic_cdk::heartbeat;
use types::{CanisterId, Cycles};
use utils::canister;
use utils::consts::{min_cycles_balance, CREATE_CANISTER_CYCLES_FEE};

#[heartbeat]
fn heartbeat() {
    topup_canister_pool::run();
}

mod topup_canister_pool {
    use super::*;

    pub fn run() {
        let (is_full, test_mode) = read_state(|state| (is_pool_full(state), state.data.test_mode));
        if !is_full {
            let cycles_to_use = GROUP_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;

            // Only create the new canister if it won't result in the cycles balance being too low
            if utils::cycles::can_spend_cycles(cycles_to_use, min_cycles_balance(test_mode)) {
                ic_cdk::spawn(add_new_canister(cycles_to_use));
            }
        }
    }

    fn is_pool_full(state: &RuntimeState) -> bool {
        state.data.canister_pool.is_full()
    }

    async fn add_new_canister(cycles_to_use: Cycles) {
        if let Ok(canister_id) = canister::create(cycles_to_use).await {
            mutate_state(|state| add_canister_to_pool(canister_id, cycles_to_use, state));
        }
    }

    fn add_canister_to_pool(canister_id: CanisterId, cycles: Cycles, state: &mut RuntimeState) {
        state.data.canister_pool.push(canister_id);
        state.data.total_cycles_spent_on_canisters += cycles;
    }
}
