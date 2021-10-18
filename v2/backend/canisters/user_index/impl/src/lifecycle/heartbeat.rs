use ic_cdk_macros::heartbeat;

#[heartbeat]
fn heartbeat() {
    topup_canister_pool::run();
    calculate_user_metrics::run();
}

mod topup_canister_pool {
    use crate::{RuntimeState, RUNTIME_STATE, USER_CANISTER_INITIAL_CYCLES_BALANCE};
    use types::{CanisterId, Cycles};
    use utils::canister;
    use utils::consts::CREATE_CANISTER_CYCLES_FEE;

    pub fn run() {
        let is_full = RUNTIME_STATE.with(|state| is_pool_full(state.borrow().as_ref().unwrap()));
        if !is_full {
            ic_cdk::block_on(add_new_canister());
        }
    }

    fn is_pool_full(runtime_state: &RuntimeState) -> bool {
        runtime_state.data.canister_pool.is_full()
    }

    async fn add_new_canister() {
        let cycles_required = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if let Ok(canister_id) = canister::create(cycles_required).await {
            RUNTIME_STATE
                .with(|state| add_canister_to_pool(canister_id, cycles_required, state.borrow_mut().as_mut().unwrap()));
        }
    }

    fn add_canister_to_pool(canister_id: CanisterId, cycles: Cycles, runtime_state: &mut RuntimeState) {
        runtime_state.data.canister_pool.push(canister_id);
        runtime_state.data.total_cycles_spent_on_canisters += cycles;
    }
}

mod calculate_user_metrics {
    use crate::{RuntimeState, RUNTIME_STATE};

    pub fn run() {
        RUNTIME_STATE.with(|state| calculate_metrics(state.borrow_mut().as_mut().unwrap()));
    }

    fn calculate_metrics(runtime_state: &mut RuntimeState) {
        let now = runtime_state.env.now();
        runtime_state.data.users.calculate_metrics(now);
    }
}
