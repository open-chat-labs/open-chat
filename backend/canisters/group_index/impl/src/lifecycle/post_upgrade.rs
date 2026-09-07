use crate::Data;
use crate::lifecycle::init_state;
use crate::memory::get_upgrades_memory;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

const PR2_SENSITIVE_HISTORY_MARKERS: &[&str] = &[
    "c2c_issue_ai_app_card_authority_v1",
    "c2c_issue_ai_app_chat_link_authority_v1",
    "c2c_cancel_ai_app_chat_link_authority_v1",
    "c2c_consume_ai_app_chat_link_authority_v1",
    "c2c_validate_ai_app_card_authority_v1",
    "c2c_consume_ai_app_card_authority_v1",
];

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, mut errors, mut logs, mut traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();
    let purged_pr2_history =
        canister_logger::purge_history_containing(&mut errors, &mut logs, &mut traces, PR2_SENSITIVE_HISTORY_MARKERS);

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);
    crate::pr2_entropy::start_after_lifecycle();

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, purged_pr2_history, "Post-upgrade complete");
}
