use crate::{Data, RuntimeState, LOW_CYCLES_BALANCE_THRESHOLD, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::init;
use user_canister::init::Args;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[init]
fn init(args: Args) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(false));
        let user_index_canister_id = env.caller();

        let data = Data::new(
            args.owner,
            user_index_canister_id,
            args.group_index_canister_id,
            args.notification_canister_ids,
            args.wasm_version,
        );
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);

        cycles_utils::init_cycles_balance_checker(LOW_CYCLES_BALANCE_THRESHOLD, user_index_canister_id);
    });

    check_cycles_balance();
}
