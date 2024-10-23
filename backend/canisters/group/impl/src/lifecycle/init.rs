use crate::lifecycle::{init_env, init_state};
use crate::memory::get_chat_events_memory;
use crate::Data;
use canister_tracing_macros::trace;
use group_canister::init::Args;
use ic_cdk::init;
use rand::Rng;
use tracing::info;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    chat_events::ChatEvents::init_stable_storage(get_chat_events_memory());

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
        args.is_public && args.messages_visible_to_non_members.unwrap_or(args.gate.is_none()),
        args.created_by_principal,
        args.created_by_user_id,
        args.created_by_user_type,
        args.events_ttl,
        env.now(),
        args.mark_active_duration,
        args.group_index_canister_id,
        args.local_group_index_canister_id,
        args.user_index_canister_id,
        args.local_user_index_canister_id,
        args.notifications_canister_id,
        args.proposals_bot_user_id,
        args.escrow_canister_id,
        args.internet_identity_canister_id,
        args.test_mode,
        args.permissions_v2,
        if args.gate_config.is_some() {
            args.gate_config.map(|gc| gc.into())
        } else {
            args.gate.map(|g| g.into())
        },
        args.video_call_operators,
        args.ic_root_key,
        env.rng().gen(),
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
