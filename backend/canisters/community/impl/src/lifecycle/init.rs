use crate::lifecycle::{init_env, init_state};
use crate::updates::import_group::commit_group_to_import;
use crate::{mutate_state, Data};
use canister_tracing_macros::trace;
use community_canister::init::Args;
use ic_cdk_macros::init;
use rand::prelude::StdRng;
use rand::{Rng, SeedableRng};
use tracing::info;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);

    let mut env = init_env([0; 32]);

    let mut channel_name_rng = StdRng::from_seed(env.entropy());

    let default_channels = args
        .default_channels
        .into_iter()
        .map(|name| (channel_name_rng.gen(), name))
        .collect();

    let data = Data::new(
        env.canister_id().into(),
        args.created_by_principal,
        args.created_by_user_id,
        args.is_public,
        args.name,
        args.description,
        args.rules,
        args.avatar,
        args.banner,
        args.permissions,
        args.primary_language,
        args.user_index_canister_id,
        args.local_user_index_canister_id,
        args.group_index_canister_id,
        args.local_group_index_canister_id,
        args.notifications_canister_id,
        args.proposals_bot_user_id,
        args.escrow_canister_id,
        args.gate,
        default_channels,
        args.default_channel_rules,
        args.mark_active_duration,
        args.video_call_operators,
        args.test_mode,
        env.now(),
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");

    if let Some(group) = args.source_group {
        mutate_state(|state| {
            commit_group_to_import(
                args.created_by_user_id,
                group.group_id,
                group.channel_id,
                group.total_bytes,
                true,
                state,
            );
        });
    }
}
