use crate::jobs::process_expire_member_actions;
use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_stable_memory_map_small_entries_memory, get_upgrades_memory};
use crate::{Data, RuntimeState, mutate_state, read_state};
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use gated_groups::checks_tokens_or_neurons;
use group_canister::post_upgrade::Args;
use group_community_common::{ExpiringMemberAction, ExpiringMemberActionDetails};
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use utils::env::canister::CanisterEnv;

#[post_upgrade(msgpack = true)]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init_with_small_entries_map(
        get_stable_memory_map_memory(),
        get_stable_memory_map_small_entries_memory(),
    );

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_state(env, data, args.wasm_version);

    mutate_state(|state| {
        let queued = check_gate_again_for_lapsed_migrated_members(state);
        info!(queued, "Queued gate checks for lapsed migrated members");
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });
}

// One-off: a recurring gate used to be checked under a migrated member's latest id alone, so members
// whose tokens were still in their old canister's wallet lapsed. Their gate is now also checked under
// their previous ids (#9892), so check it again for each lapsed member who has been migrated,
// unlapsing those who pass.
fn check_gate_again_for_lapsed_migrated_members(state: &mut RuntimeState) -> usize {
    let Some(gate_config) = state.data.chat.gate_config.value.as_ref() else {
        return 0;
    };
    let Some(gate_expiry) = gate_config.expiry() else {
        return 0;
    };
    if !checks_tokens_or_neurons(gate_config.gate()) {
        return 0;
    }

    let now = state.env.now();
    let user_ids: Vec<_> = state
        .data
        .chat
        .members
        .lapsed()
        .iter()
        .copied()
        .filter(|user_id| !state.data.migrated_user_ids.previous_ids(*user_id).is_empty())
        .collect();

    for &user_id in user_ids.iter() {
        state
            .data
            .expiring_member_actions
            .push(ExpiringMemberAction::AsyncGateCheck(ExpiringMemberActionDetails {
                user_id,
                channel_id: None,
                member_expires: now,
                original_gate_expiry: gate_expiry,
                unlapse_only: true,
            }));
    }
    process_expire_member_actions::start_job_if_required(state);
    user_ids.len()
}
