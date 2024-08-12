use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use types::BotConfig;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        let now = state.env.now();
        state.data.users.set_bot_config(
            state.data.proposals_bot_canister_id.into(),
            BotConfig {
                is_oc_controlled: true,
                supports_direct_messages: false,
                can_be_added_to_groups: false,
            },
            now,
        );
        state.data.users.set_bot_config(
            state.data.airdrop_bot_canister_id.into(),
            BotConfig {
                is_oc_controlled: true,
                supports_direct_messages: true,
                can_be_added_to_groups: false,
            },
            now,
        );
    });
}
