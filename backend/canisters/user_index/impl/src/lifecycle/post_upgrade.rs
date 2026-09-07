use crate::Data;
use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

const PR2_SENSITIVE_HISTORY_MARKERS: &[&str] = &[
    "cancel_ai_app_link_code",
    "create_ai_app_link_code",
    "claim_ai_app_link_code",
    "c2c_claim_ai_app_link_code",
    "set_my_ai_app_key",
    "remove_my_ai_app_key",
    "revoke_ai_app_user_key",
    "create_ai_app_card_provenance",
    "c2c_validate_ai_app_card_provenance",
    "c2c_create_ai_app_card_capability",
    "c2c_create_ai_app_private_match_capability",
    "c2c_redeem_ai_app_card_capability",
    "c2c_redeem_ai_app_private_match_capability",
    "c2c_create_ai_app_chat_link_token",
    "c2c_cancel_ai_app_chat_link_token",
    "c2c_redeem_ai_app_chat_link_token",
    "cancel_ai_app_chat_link_token",
    "c2c_create_ai_app_card_confirmation_grant",
    "c2c_consume_ai_app_card_confirmation_grant",
    "c2c_ai_app_confirmed_action_route",
    "c2c_deposit_actions",
];

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, mut errors, mut logs, mut traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();
    let purged_pr2_history =
        canister_logger::purge_history_containing(&mut errors, &mut logs, &mut traces, PR2_SENSITIVE_HISTORY_MARKERS);

    // V1 vouched only for a caller-supplied name. Treat every legacy publication as untrusted after
    // the V2 rollout and require its owner/governance flow to republish the exact manifest binding.
    let legacy_v1_publications = data.ai_apps.require_v2_republication(canister_time::now_millis());

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);
    crate::pr2_entropy::start_after_lifecycle();

    if legacy_v1_publications > 0 {
        info!(legacy_v1_publications, "Unpublished legacy V1 AI apps; V2 republish required");
    }
    // Heap state is authoritative after restore. Scrub the disposable raw snapshot in fixed-size
    // timer messages; this overwrites stale trailing bytes as well as the current serialized state.
    crate::jobs::scrub_upgrade_snapshot::start_after_restore();

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, purged_pr2_history, "Post-upgrade complete");
}
