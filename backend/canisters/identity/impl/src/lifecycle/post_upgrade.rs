use crate::lifecycle::init_state;
use crate::memory::get_upgrades_memory;
use crate::{Data, mutate_state};
use candid::Principal;
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

    // One-off: WebAuthn keys registered by authenticators which set the ED flag (eg. YubiKeys adding a
    // `credProtect` extension) were stored with the CBOR extensions map appended to the COSE key, so the
    // IC rejected them and those users were locked out (#9277). Strip the trailing bytes and remap each
    // affected auth principal to the one derived from the repaired key.
    // TODO remove after the release containing this has been deployed
    mutate_state(|state| {
        for repaired in state.data.webauthn_keys.repair_malformed_keys() {
            let old_principal = Principal::self_authenticating(&repaired.old_public_key);
            let new_principal = Principal::self_authenticating(&repaired.new_public_key);
            let remapped = state
                .data
                .user_principals
                .replace_auth_principal(old_principal, new_principal);
            info!(
                credential_id = %hex::encode(&repaired.credential_id),
                %old_principal,
                %new_principal,
                remapped,
                "Repaired malformed WebAuthn key"
            );
        }
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
