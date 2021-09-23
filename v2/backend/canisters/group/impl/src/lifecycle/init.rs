use crate::{Data, RuntimeState, LOW_CYCLES_BALANCE_THRESHOLD, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::init::Args;
use ic_cdk_macros::init;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[init]
fn init(args: Args) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(false));
        let group_index_canister_id = env.caller();
        let data = Data::new(
            env.canister_id().into(),
            args.is_public,
            args.name,
            args.description,
            args.avatar,
            args.history_visible_to_new_joiners,
            args.created_by_principal,
            args.created_by_user_id,
            env.now(),
            args.mark_active_duration,
            group_index_canister_id,
            args.wasm_version,
        );
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);

        cycles_utils::init_cycles_balance_checker(LOW_CYCLES_BALANCE_THRESHOLD, group_index_canister_id);
    });

    check_cycles_balance();
}
