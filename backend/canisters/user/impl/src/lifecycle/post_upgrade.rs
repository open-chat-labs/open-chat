use crate::jobs::migrate_direct_chat_events_to_key_id_keys;
use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_stable_memory_map_small_entries_memory, get_upgrades_memory};
use crate::{Data, mutate_state};
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use stable_memory::get_reader;
use stable_memory_map::ProfileDocumentType;
use tracing::info;
use types::MultiUserChat;
use user_canister::post_upgrade::Args;
use utils::env::canister::CanisterEnv;

// The instruction budget for migrating direct chat events within `post_upgrade`
const MAX_MIGRATION_INSTRUCTIONS: u64 = 10_000_000_000;

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

    // Give each existing direct chat a `key_id`, so that every stable memory entry written from
    // here on (including by the migrations below) is keyed by it rather than by the other user's
    // id. The events themselves are moved to the new keys at the end of `post_upgrade`.
    // TODO: Remove this after next release
    let key_ids_assigned = data.direct_chats.assign_key_ids();
    info!(key_ids_assigned, "Assigned key_ids to direct chats");

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

    // Move the P2P swaps into stable memory
    // TODO: Remove this after next release
    let p2p_swaps_migrated = data.p2p_swaps.migrate_to_stable_memory();
    info!(p2p_swaps_migrated, "Migrated P2P swaps to stable memory");

    // Move the streak insurance payments and claims into stable memory
    // TODO: Remove this after next release
    let streak_insurance_migrated = data.streak.migrate_to_stable_memory();
    info!(
        streak_insurance_migrated,
        "Migrated streak insurance payments and claims to stable memory"
    );

    // Move the contacts into stable memory
    // TODO: Remove this after next release
    let contacts_migrated = data.contacts.migrate_to_stable_memory();
    info!(contacts_migrated, "Migrated contacts to stable memory");

    // Move the blocked users into stable memory
    // TODO: Remove this after next release
    let blocked_users_migrated = data.blocked_users.migrate_to_stable_memory();
    info!(blocked_users_migrated, "Migrated blocked users to stable memory");

    // Move each direct chat's map of unread message indexes into stable memory, under keys derived
    // from the chat's `key_id` (which every chat has been assigned above)
    // TODO: Remove this after next release
    let mut unread_message_indexes_migrated = 0;
    for direct_chat in data.direct_chats.iter_mut() {
        unread_message_indexes_migrated += direct_chat.migrate_unread_message_indexes_to_stable_memory();
    }
    info!(
        unread_message_indexes_migrated,
        "Migrated unread message indexes to stable memory"
    );

    // Move the records of the chats the user has been removed from into stable memory
    // TODO: Remove this after next release
    let removed_chats_migrated = data.direct_chats.migrate_removed_to_stable_memory()
        + data.group_chats.migrate_removed_to_stable_memory()
        + data.communities.migrate_removed_to_stable_memory();
    info!(removed_chats_migrated, "Migrated removed chats to stable memory");

    // Move the private replies to groups into stable memory
    // TODO: Remove this after next release
    let private_replies_migrated = data.direct_chats.migrate_private_replies_to_stable_memory();
    info!(private_replies_migrated, "Migrated private replies to stable memory");

    // Move the avatar and profile background into stable memory
    // TODO: Remove this after next release
    let avatar_migrated = data.avatar.migrate_to_stable_memory(ProfileDocumentType::Avatar);
    let profile_background_migrated = data
        .profile_background
        .migrate_to_stable_memory(ProfileDocumentType::ProfileBackground);
    info!(
        avatar_migrated,
        profile_background_migrated, "Migrated avatar and profile background to stable memory"
    );

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_state(env, data, args.wasm_version);

    mutate_state(|state| state.data.drain_legacy_user_canister_events_queue());

    // Stop storing the other user's metrics in existing direct chats, deleting any already stored.
    // TODO: Remove this after next release
    mutate_state(|state| {
        let my_user_id = state.env.canister_id().into();
        for chat in state.data.direct_chats.iter_mut() {
            chat.skip_their_metrics(my_user_id);
        }
    });

    // Mark the user's chat with themselves as such, now that self chats are marked at creation
    // TODO: Remove this after next release
    mutate_state(|state| {
        let my_user_id = state.env.canister_id().into();
        let self_chat_migrated = state.data.direct_chats.migrate_self_chat(my_user_id);
        info!(self_chat_migrated, "Marked the user's chat with themselves");
    });

    // Move the events of existing direct chats to their `key_id` based keys, checking the
    // instruction usage as it goes and handing over to a timer job if the budget runs out.
    // TODO: Remove this after next release
    mutate_state(|state| {
        let max_instructions = migrate_direct_chat_events_to_key_id_keys::max_instructions(state, MAX_MIGRATION_INSTRUCTIONS);
        let complete = migrate_direct_chat_events_to_key_id_keys::run_batch(state, max_instructions);
        if !complete {
            migrate_direct_chat_events_to_key_id_keys::start_job_if_required(state);
        }
        info!(complete, "Migrated direct chat events to key_id keys");
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
