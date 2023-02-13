use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    let local_group_indexes: Vec<_> = ["suaf3-hqaaa-aaaaf-bfyoa-cai", "ainth-qaaaa-aaaar-aaaba-cai"]
        .into_iter()
        .map(|str| Principal::from_text(str).unwrap())
        .collect();

    // Register the local group indexes as super admins
    mutate_state(|state| {
        let now = state.env.now();

        for (index, canister_id) in local_group_indexes.into_iter().enumerate() {
            let username = format!("GroupUpgradeBot{}", index + 1);
            state.data.register_super_admin_bot(canister_id, username, now);
        }
    })
}
