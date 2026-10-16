use crate::lifecycle::init_state;
use crate::memory::get_upgrades_memory;
use crate::{Data, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use multi_user_canister::GroupIndexEvent;
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

    // One-off: the members still to be told of a deletion by the jobs which the user canister events
    // queue replaced are told via the queue instead
    // TODO: remove once released
    mutate_state(|state| {
        let now = state.env.now();
        let group_deleted = state.data.deleted_groups.take_pending_notifications();
        let community_deleted = state.data.deleted_communities.take_pending_notifications();
        let count = group_deleted.len() + community_deleted.len();
        for (user_id, deleted_group) in group_deleted {
            state.push_event_to_users([user_id], GroupIndexEvent::GroupDeleted(Box::new(deleted_group)), now);
        }
        for (user_id, deleted_community) in community_deleted {
            state.push_event_to_users([user_id], GroupIndexEvent::CommunityDeleted(Box::new(deleted_community)), now);
        }
        info!(
            count,
            "Moved the pending deleted notifications onto the user canister events queue"
        );
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
