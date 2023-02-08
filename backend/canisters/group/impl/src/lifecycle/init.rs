use crate::lifecycle::{init_state, reseed_rng};
use crate::Data;
use canister_tracing_macros::trace;
use group_canister::init::Args;
use ic_cdk_macros::init;
use std::time::Duration;
use tracing::info;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);

    let env = Box::<CanisterEnv>::default();

    let data = Data::new(
        env.canister_id().into(),
        args.is_public,
        args.name,
        args.description,
        args.rules,
        args.subtype,
        args.avatar,
        args.history_visible_to_new_joiners,
        args.created_by_principal,
        args.created_by_user_id,
        args.events_ttl,
        env.now(),
        args.mark_active_duration,
        args.group_index_canister_id,
        args.local_group_index_canister_id,
        args.user_index_canister_id,
        args.local_user_index_canister_id,
        args.notifications_canister_id,
        args.ledger_canister_id,
        args.test_mode,
        args.permissions,
    );

    init_state(env, data, args.wasm_version);

    ic_cdk::timer::set_timer(Duration::default(), reseed_rng);

    info!(version = %args.wasm_version, "Initialization complete");
}
