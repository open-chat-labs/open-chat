use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_stable_memory_map_small_entries_memory, get_upgrades_memory};
use crate::{Data, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use community_canister::post_upgrade::Args;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use types::{TimestampMillis, UserId};
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

    // One-off: removes a member who deleted their account in 2025 but was never removed from the
    // community. Their old User canister was uninstalled after running out of cycles, and the events
    // queued for them are retried forever.
    // TODO: revert once released
    mutate_state(|state| {
        let now = state.env.now();
        if let Some(dropped) = state.data.remove_deleted_member(deleted_user_id(), now) {
            info!(dropped, "Removed a member who has deleted their account");
        }
    });

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now);
    });
}

fn deleted_user_id() -> UserId {
    Principal::from_text("5q4yt-gqaaa-aaaac-arana-cai").unwrap().into()
}

impl Data {
    // Removes the user from the community and its channels, and drops the events queued for them,
    // returning how many were dropped, or `None` if they weren't a member
    fn remove_deleted_member(&mut self, user_id: UserId, now: TimestampMillis) -> Option<usize> {
        self.members.remove(user_id, None, now)?;
        for channel in self.channels.iter_mut() {
            channel.chat.members.remove(user_id, now);
        }
        Some(self.user_events_queue.take(&user_id.canister_id()).len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::UserType;

    #[test]
    fn the_deleted_member_is_removed() {
        let owner = UserId::new_indexed(types::CanisterId::from_slice(&[0, 0, 0, 0, 0, 0, 0, 1, 1, 1]), 1);
        let mut data = Data::new_for_tests(owner, Principal::from_slice(&[1]), String::new(), Vec::new());
        data.members
            .add(deleted_user_id(), Principal::from_slice(&[2]), UserType::User, None, 0);

        assert_eq!(data.remove_deleted_member(deleted_user_id(), 1), Some(0));
        assert!(!data.members.contains(&deleted_user_id()));
        assert!(data.members.contains(&owner));
        // Running it again finds nothing to remove
        assert_eq!(data.remove_deleted_member(deleted_user_id(), 2), None);
    }
}
