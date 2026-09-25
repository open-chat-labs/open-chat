use crate::data_previous::{DataPrevious, data_is_current_layout};
use crate::jobs::migrate_direct_chat_events_to_key_id_keys;
use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_stable_memory_map_small_entries_memory, get_upgrades_memory};
use crate::timer_job_types::TimerJob;
use crate::{Data, mutate_state};
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use stable_memory::get_reader;
use stable_memory_map::ProfileDocumentType;
use std::ops::Deref;
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

    // A canister upgraded from a version which held the user's fields directly in `Data` holds the
    // previous layout. Which layout it is must be settled before parsing, rather than by trying one
    // and falling back to the other, since deserializing the timer jobs and event queues sets
    // their timers, which a failed parse would leave set as well.
    // TODO: Remove the previous layout once every user canister has been upgraded past it
    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        if data_is_current_layout(get_reader(&memory)) {
            msgpack::deserialize(get_reader(&memory)).unwrap()
        } else {
            let (data, errors, logs, traces): (DataPrevious, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
                msgpack::deserialize(get_reader(&memory)).unwrap();
            (data.into(), errors, logs, traces)
        };

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    // Nothing may change the state of a canister whose user is being migrated, since the MultiUser
    // canister pulls the user's stable memory entries as they are, so none of the migrations below
    // run on it
    if data.is_migrating() {
        let env = Box::new(CanisterEnv::new(data.rng_seed));
        init_state(env, data, args.wasm_version);
        info!(version = %args.wasm_version, "Post-upgrade complete, skipping migrations since the user is being migrated");
        return;
    }

    // Give each existing direct chat a `key_id`, so that every stable memory entry written from
    // here on (including by the migrations below) is keyed by it rather than by the other user's
    // id. The events themselves are moved to the new keys at the end of `post_upgrade`.
    // TODO: Remove this after next release
    let key_ids_assigned = data.user.direct_chats.assign_key_ids();
    info!(key_ids_assigned, "Assigned key_ids to direct chats");

    // Move the message activity events into stable memory. The feed holds at most 1000 events, so
    // they can all be moved here rather than by a timer job, which would cost an extra call.
    // TODO: Remove this after next release
    let message_activity_events_migrated = data.user.message_activity_events.migrate_to_stable_memory();
    info!(
        message_activity_events_migrated,
        "Migrated message activity events to stable memory"
    );

    // Move the CHIT events into stable memory
    // TODO: Remove this after next release
    let chit_events_migrated = data.user.chit_events.migrate_to_stable_memory();
    info!(chit_events_migrated, "Migrated CHIT events to stable memory");

    // Move how far the user has read each thread into stable memory
    // TODO: Remove this after next release
    let mut threads_read_migrated = 0;
    for group in data.user.group_chats.iter_mut() {
        threads_read_migrated += group
            .messages_read
            .threads_read
            .migrate_to_stable_memory(MultiUserChat::Group(group.chat_id));
    }
    for community in data.user.communities.iter_mut() {
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
    let token_swaps_migrated = data.user.token_swaps.migrate_to_stable_memory();
    info!(token_swaps_migrated, "Migrated token swaps to stable memory");

    // Move the referrals into stable memory
    // TODO: Remove this after next release
    let referrals_migrated = data.user.referrals.migrate_to_stable_memory();
    info!(referrals_migrated, "Migrated referrals to stable memory");

    // Move the P2P swaps into stable memory
    // TODO: Remove this after next release
    let p2p_swaps_migrated = data.user.p2p_swaps.migrate_to_stable_memory();
    info!(p2p_swaps_migrated, "Migrated P2P swaps to stable memory");

    // Record the latest expiry of the P2P swaps from before they were recorded as they happen: those
    // the user created or accepted, and those they were offered in a direct chat, each of which has a
    // pending job to mark it expired
    // TODO: Remove this after next release
    let latest_p2p_swap_expiry = data
        .user
        .p2p_swaps
        .latest_expiry()
        .into_iter()
        .chain(data.timer_jobs.iter().filter_map(|(due, wrapper)| {
            matches!(wrapper.deref().borrow().as_ref(), Some(TimerJob::MarkP2PSwapExpired(_))).then_some(*due)
        }))
        .max();
    if let Some(expires_at) = latest_p2p_swap_expiry {
        data.record_p2p_swap(expires_at);
    }
    info!(?latest_p2p_swap_expiry, "Recorded the latest P2P swap expiry");

    // Move the streak insurance payments and claims into stable memory
    // TODO: Remove this after next release
    let streak_insurance_migrated = data.user.streak.migrate_to_stable_memory();
    info!(
        streak_insurance_migrated,
        "Migrated streak insurance payments and claims to stable memory"
    );

    // Move the contacts into stable memory
    // TODO: Remove this after next release
    let contacts_migrated = data.user.contacts.migrate_to_stable_memory();
    info!(contacts_migrated, "Migrated contacts to stable memory");

    // Move the blocked users into stable memory
    // TODO: Remove this after next release
    let blocked_users_migrated = data.user.blocked_users.migrate_to_stable_memory();
    info!(blocked_users_migrated, "Migrated blocked users to stable memory");

    // Move each direct chat's map of unread message indexes into stable memory, under keys derived
    // from the chat's `key_id` (which every chat has been assigned above)
    // TODO: Remove this after next release
    let mut unread_message_indexes_migrated = 0;
    for direct_chat in data.user.direct_chats.iter_mut() {
        unread_message_indexes_migrated += direct_chat.migrate_unread_message_indexes_to_stable_memory();
    }
    info!(
        unread_message_indexes_migrated,
        "Migrated unread message indexes to stable memory"
    );

    // Move the records of the chats the user has been removed from into stable memory
    // TODO: Remove this after next release
    let removed_chats_migrated = data.user.direct_chats.migrate_removed_to_stable_memory()
        + data.user.group_chats.migrate_removed_to_stable_memory()
        + data.user.communities.migrate_removed_to_stable_memory();
    info!(removed_chats_migrated, "Migrated removed chats to stable memory");

    // Move the private replies to groups into stable memory
    // TODO: Remove this after next release
    let private_replies_migrated = data.user.direct_chats.migrate_private_replies_to_stable_memory();
    info!(private_replies_migrated, "Migrated private replies to stable memory");

    // Move the avatar and profile background into stable memory
    // TODO: Remove this after next release
    let avatar_migrated = data.user.avatar.migrate_to_stable_memory(ProfileDocumentType::Avatar);
    let profile_background_migrated = data
        .user
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
        for chat in state.data.user.direct_chats.iter_mut() {
            chat.skip_their_metrics(my_user_id);
        }
    });

    // Mark the user's chat with themselves as such, now that self chats are marked at creation
    // TODO: Remove this after next release
    mutate_state(|state| {
        let my_user_id = state.env.canister_id().into();
        let self_chat_migrated = state.data.user.direct_chats.migrate_self_chat(my_user_id);
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
