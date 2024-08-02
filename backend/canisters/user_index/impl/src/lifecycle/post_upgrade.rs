use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
use stable_memory::get_reader;
use tracing::info;
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

    read_state(|state| {
        let account_id =
            AccountIdentifier::from_hex("0d8b25153f3450c024a30694e8834d199387a9d9a0f2641d053719cc6068223c").unwrap();

        for user in state.data.deleted_users.iter() {
            if AccountIdentifier::new(&user.user_id.into(), &DEFAULT_SUBACCOUNT) == account_id {
                info!("Found match: {}", user.user_id);
                break;
            }
        }
    });
}
