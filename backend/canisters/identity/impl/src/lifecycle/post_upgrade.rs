use crate::lifecycle::init_state;
use crate::memory::get_upgrades_memory;
use crate::{Data, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use identity_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    // One-off: WebAuthn keys were never removed when the auth principal using them was unlinked or its
    // user deleted (#9309), so drop every key no auth principal can sign in with. A key is only removed
    // if both the auth principal derived from its public key is gone and no auth principal refers to
    // its credential id, so nothing anyone can still sign in with is touched.
    // TODO remove after the release containing this has been deployed
    mutate_state(|state| {
        let removed = state.data.webauthn_keys.remove_orphaned_keys(&state.data.user_principals);
        let remaining = state.data.webauthn_keys.len();
        info!(removed, remaining, "Removed orphaned WebAuthn keys");
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
