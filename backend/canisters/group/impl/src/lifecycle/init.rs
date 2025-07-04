use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::get_stable_memory_map_memory;
use canister_api_macros::init;
use canister_tracing_macros::trace;
use group_canister::init::Args;
use rand::Rng;
use tracing::info;
use utils::env::Environment;

#[init(msgpack = true)]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    stable_memory_map::init(get_stable_memory_map_memory());

    let mut env = init_env([0; 32]);

    let data = Data::new(
        env.canister_id().into(),
        args.is_public,
        args.name,
        args.description,
        args.rules,
        args.subtype,
        args.avatar,
        args.history_visible_to_new_joiners,
        args.is_public && args.messages_visible_to_non_members.unwrap_or(args.gate_config.is_none()),
        args.created_by_principal,
        args.created_by_user_id,
        args.created_by_user_type,
        args.events_ttl,
        env.now(),
        args.mark_active_duration,
        args.group_index_canister_id,
        args.user_index_canister_id,
        args.local_user_index_canister_id,
        args.proposals_bot_user_id,
        args.escrow_canister_id,
        args.internet_identity_canister_id,
        args.test_mode,
        args.permissions_v2,
        args.gate_config.map(|g| g.into()),
        args.video_call_operators,
        args.ic_root_key,
        env.rng().r#gen(),
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
