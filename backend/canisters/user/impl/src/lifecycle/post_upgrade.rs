use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_stable_memory_map_small_entries_memory, get_upgrades_memory};
use crate::{Data, mutate_state};
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use stable_memory::get_reader;
use tracing::info;
use types::MultiUserChat;
use user_canister::post_upgrade::Args;
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

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    // Move the message activity events into stable memory. The feed holds at most 1000 events, so
    // they can all be moved here rather than by a timer job, which would cost an extra call.
    // TODO: Remove this after next release
    let message_activity_events_migrated = data.message_activity_events.migrate_to_stable_memory();
    info!(
        message_activity_events_migrated,
        "Migrated message activity events to stable memory"
    );

    // Move the CHIT events into stable memory
    // TODO: Remove this after next release
    let chit_events_migrated = data.chit_events.migrate_to_stable_memory();
    info!(chit_events_migrated, "Migrated CHIT events to stable memory");

    // Move how far the user has read each thread into stable memory
    // TODO: Remove this after next release
    let mut threads_read_migrated = 0;
    for group in data.group_chats.iter_mut() {
        threads_read_migrated += group
            .messages_read
            .threads_read
            .migrate_to_stable_memory(MultiUserChat::Group(group.chat_id));
    }
    for community in data.communities.iter_mut() {
        let community_id = community.community_id;
        for channel in community.channels.values_mut() {
            threads_read_migrated += channel
                .messages_read
                .threads_read
                .migrate_to_stable_memory(MultiUserChat::Channel(community_id, channel.channel_id));
        }
    }
    info!(threads_read_migrated, "Migrated threads read to stable memory");

    // Move the token swaps into stable memory
    // TODO: Remove this after next release
    let token_swaps_migrated = data.token_swaps.migrate_to_stable_memory();
    info!(token_swaps_migrated, "Migrated token swaps to stable memory");

    // Move the referrals into stable memory
    // TODO: Remove this after next release
    let referrals_migrated = data.referrals.migrate_to_stable_memory();
    info!(referrals_migrated, "Migrated referrals to stable memory");

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_state(env, data, args.wasm_version);

    // Stop storing the other user's metrics in existing direct chats, deleting any already stored.
    // TODO: Remove this after next release
    mutate_state(|state| {
        let my_user_id = state.env.canister_id().into();
        for chat in state.data.direct_chats.iter_mut() {
            chat.events.skip_their_metrics(my_user_id);
        }
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
