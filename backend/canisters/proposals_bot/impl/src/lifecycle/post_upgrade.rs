use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use proposals_bot_canister::post_upgrade::Args;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, Empty};
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

    ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::spawn(fetch_ledger_canister_ids()));
}

async fn fetch_ledger_canister_ids() {
    let sns_wasm_canister_id = read_state(|state| state.data.sns_wasm_canister_id);

    if let Ok(response) = sns_wasm_canister_c2c_client::list_deployed_snses(sns_wasm_canister_id, &Empty {}).await {
        mutate_state(|state| {
            for sns in response.instances {
                state
                    .data
                    .nervous_systems
                    .set_ledger_canister_id(sns.governance_canister_id.unwrap(), sns.ledger_canister_id.unwrap());
            }

            let nns_governance_canister_id = CanisterId::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap();
            let nns_ledger_canister_id = CanisterId::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
            state
                .data
                .nervous_systems
                .set_ledger_canister_id(nns_governance_canister_id, nns_ledger_canister_id);
        });
    }
}
