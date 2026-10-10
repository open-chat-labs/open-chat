use crate::jobs::import_groups::finalize_group_import;
use crate::jobs::process_expire_member_actions;
use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_stable_memory_map_small_entries_memory, get_upgrades_memory};
use crate::{Data, RuntimeState, mutate_state, read_state};
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use community_canister::post_upgrade::Args;
use gated_groups::checks_tokens_or_neurons;
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

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

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
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now);
    });
}

// One-off: a recurring gate used to be checked under a migrated member's latest id alone, so members
// whose tokens were still in their old canister's wallet lapsed. Their gate is now also checked under
// their previous ids (#9892), so check it again for each lapsed member who has been migrated, of the
// community and of each channel, unlapsing those who pass.
fn check_gate_again_for_lapsed_migrated_members(state: &mut RuntimeState) -> usize {
    let data = &state.data;
    let mut to_check = Vec::new();

    let community = (None, data.gate_config.value.as_ref(), data.members.lapsed());
    let channels = data
        .channels
        .iter()
        .map(|c| (Some(c.id), c.chat.gate_config.value.as_ref(), c.chat.members.lapsed()));

    for (channel_id, gate_config, lapsed) in [community].into_iter().chain(channels) {
        let Some(gate_config) = gate_config else {
            continue;
        };
        let Some(gate_expiry) = gate_config.expiry() else {
            continue;
        };
        if !checks_tokens_or_neurons(gate_config.gate()) {
            continue;
        }
        for &user_id in lapsed {
            if !data.migrated_user_ids.previous_ids(user_id).is_empty() {
                to_check.push((user_id, channel_id, gate_expiry));
            }
        }
    }

    let now = state.env.now();
    let queued = to_check.len();
    for (user_id, channel_id, gate_expiry) in to_check {
        state
            .data
            .expiring_member_actions
            .push(ExpiringMemberAction::AsyncGateCheck(ExpiringMemberActionDetails {
                user_id,
                channel_id,
                member_expires: now,
                original_gate_expiry: gate_expiry,
            }));
    }
    process_expire_member_actions::start_job_if_required(state);
    queued
}
