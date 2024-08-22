use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use types::Timestamped;
use user_canister::post_upgrade::Args;
use user_canister::WalletConfig;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    // TODO: Delete this after next release
    mutate_state(|state| {
        if let WalletConfig::Auto(config) = &state.data.wallet_config.value {
            if config.min_cents_visible == 100 {
                state.data.wallet_config = Timestamped::new(WalletConfig::default(), state.env.now());
            }
        }
    });

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
