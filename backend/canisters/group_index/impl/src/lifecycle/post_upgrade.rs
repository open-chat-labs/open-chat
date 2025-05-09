use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::updates::upgrade_community_canister_wasm::upgrade_community_wasm_in_local_group_index;
use crate::updates::upgrade_group_canister_wasm::upgrade_group_wasm_in_local_group_index;
use crate::{Data, mutate_state, read_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::ChildCanisterType;
use group_index_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::collections::HashMap;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, UpgradesFilter};
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    let test_mode = data.test_mode;

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::ZERO, move || {
        ic_cdk::futures::spawn(switch_to_local_user_indexes(test_mode));
    });
}

async fn switch_to_local_user_indexes(test_mode: bool) {
    // Switch the LocalGroupIndex canisterIds to the LocalUserIndex canisterIds, since the
    // LocalUserIndexes now support all the functionality of the LocalGroupIndexes and we will soon
    // remove the LocalGroupIndexes
    let mut index_replacements = Vec::new();
    if test_mode {
        index_replacements.push((
            CanisterId::from_text("sbhuw-gyaaa-aaaaf-bfynq-cai").unwrap(),
            CanisterId::from_text("pecvb-tqaaa-aaaaf-bhdiq-cai").unwrap(),
        ));
    } else {
        index_replacements.push((
            CanisterId::from_text("suaf3-hqaaa-aaaaf-bfyoa-cai").unwrap(),
            CanisterId::from_text("nq4qv-wqaaa-aaaaf-bhdgq-cai").unwrap(),
        ));
        index_replacements.push((
            CanisterId::from_text("ainth-qaaaa-aaaar-aaaba-cai").unwrap(),
            CanisterId::from_text("aboy3-giaaa-aaaar-aaaaq-cai").unwrap(),
        ));
        index_replacements.push((
            CanisterId::from_text("lrqxq-2qaaa-aaaac-aadla-cai").unwrap(),
            CanisterId::from_text("lyt4m-myaaa-aaaac-aadkq-cai").unwrap(),
        ));
    }
    let index_replacements_map: HashMap<_, _> = index_replacements.into_iter().collect();

    let (group_canister_wasm, community_canister_wasm) = read_state(|state| {
        (
            state.data.child_canister_wasms.get(ChildCanisterType::Group).clone(),
            state.data.child_canister_wasms.get(ChildCanisterType::Community).clone(),
        )
    });
    let filter = UpgradesFilter {
        include: [CanisterId::anonymous()].into_iter().collect(),
        ..Default::default()
    };

    for index in index_replacements_map.values().copied() {
        upgrade_group_wasm_in_local_group_index(
            index,
            &group_canister_wasm.wasm,
            group_canister_wasm.wasm_hash,
            Some(filter.clone()),
        )
        .await
        .unwrap();

        upgrade_community_wasm_in_local_group_index(
            index,
            &community_canister_wasm.wasm,
            community_canister_wasm.wasm_hash,
            Some(filter.clone()),
        )
        .await
        .unwrap();
    }

    mutate_state(|state| state.data.local_index_map.switch_index_canisters(index_replacements_map));
}
