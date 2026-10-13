use crate::Data;
use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use user_index_canister::ChildCanisterType;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    // One-off: there are no User canisters left, so their wasm is no longer needed
    #[expect(deprecated)]
    let user_wasm_removed = data.child_canister_wasms.remove(ChildCanisterType::User);

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    replace_old_user_ids(&mut data);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, user_wasm_removed, "Post-upgrade complete");
}

// One-off: replaces the ids users had before being migrated to a MultiUser canister with their latest
// ids, in the reported messages and where users store them. Until then, a sanction against a report's
// sender named by their old id found no user, so was silently skipped. And a report made after its
// sender was migrated, but naming their old id, wasn't recorded against them, so is now.
// TODO remove after the release containing this has been deployed
fn replace_old_user_ids(data: &mut Data) {
    let reports = data.reported_messages.replace_old_user_ids(&data.migrated_user_ids);
    let mut reports_recorded_against_senders = 0;
    for (report_index, sender) in reports.senders_replaced.iter() {
        if data.users.add_reported_message_if_missing(*sender, *report_index) {
            reports_recorded_against_senders += 1;
        }
    }
    let (suspended_by_replaced, installed_by_replaced) = data.users.replace_old_user_ids(&data.migrated_user_ids);

    info!(
        reports_updated = reports.reports_updated,
        senders_replaced = reports.senders_replaced.len(),
        reports_recorded_against_senders,
        lookup_keys_replaced = reports.lookup_keys_replaced,
        lookup_keys_merged = reports.lookup_keys_merged,
        recent_reporters_replaced = reports.recent_reporters_replaced,
        suspended_by_replaced,
        installed_by_replaced,
        "Replaced old user ids with their latest"
    );
}
