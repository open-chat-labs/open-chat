use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{Achievement, Timestamped};
use user_canister::post_upgrade::Args;
use user_canister::WalletConfig;
use utils::time::MonthKey;

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
        // 2024-08-22 09:00 UTC
        if state.data.wallet_config.timestamp < 1724317200000 {
            if let WalletConfig::Auto(config) = &state.data.wallet_config.value {
                if config.min_cents_visible == 100 {
                    state.data.wallet_config = Timestamped::new(WalletConfig::default(), state.env.now());
                }
            }
        }

        if !state.data.is_lifetime_diamond_member()
            && state.data.achievements.remove(&Achievement::UpgradedToGoldDiamond)
            && state.data.chit_events.remove_achievement(Achievement::UpgradedToGoldDiamond)
        {
            ic_cdk_timers::set_timer(Duration::ZERO, notify_user_index_of_july_chit);
        }
    });

    info!(version = %args.wasm_version, "Post-upgrade complete");
}

fn notify_user_index_of_july_chit() {
    let end_of_july = MonthKey::new(2024, 8).start_timestamp() - 1;
    mutate_state(|state| state.data.notify_user_index_of_chit(end_of_july));
}
