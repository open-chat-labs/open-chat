use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use registry_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    let old_naut_ledger = CanisterId::from_text("alp3y-eiaaa-aaaak-akoya-cai").unwrap();
    let new_naut_ledger = CanisterId::from_text("u2mpw-6yaaa-aaaam-aclrq-cai").unwrap();

    mutate_state(|state| {
        if let Some(token) = state.data.tokens.get(old_naut_ledger) {
            let now = state.env.now();
            state.data.tokens.add(
                new_naut_ledger,
                token.name.clone(),
                token.symbol.clone(),
                token.decimals,
                token.fee,
                token.logo.clone(),
                token.info_url.clone(),
                token.how_to_buy_url.clone(),
                token.transaction_url_format.clone(),
                token.supported_standards.clone(),
                now,
            );
            state.data.tokens.set_enabled(old_naut_ledger, false, now);
        }
    });
}
