use crate::model::channels::Channels;
use crate::model::events::CommunityEvents;
use crate::{RuntimeState, mutate_state, read_state, run_regular_jobs};
use chat_events::UserIdsInEventsMigration;
use ic_cdk_timers::TimerId;
use serde::{Deserialize, Serialize};
use std::cell::Cell;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{CanisterId, ChannelId, EventContext, EventIndex, UserId};
use utils::migrated_user_ids::MigratedUserIds;

const MAX_INSTRUCTIONS_PER_BATCH: u64 = 2_000_000_000;
const MAX_USER_IDS_PER_LOOKUP: usize = 5_000;
const LOOKUP_RETRY_DELAY: Duration = Duration::from_secs(60);

// Where an event is within the community
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum EventLocation {
    #[serde(rename = "c")]
    Community(EventIndex),
    #[serde(rename = "ch")]
    Channel(ChannelId, EventContext),
}

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Replaces the ids users had before being migrated to MultiUser canisters with their latest ids in
// every event (see `UserIdsInEventsMigration`), scanning the community's own events and then each
// channel's, in order of id.
// Each run does one of these, in order of priority: updates a batch of the events holding ids which
// have been looked up and found to have been migrated, looks up a batch of the ids found by the
// scan in the LocalUserIndex, or scans a batch of events. This can be removed once it has completed
// in every community.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.user_ids_in_events_migration.is_complete() {
        start_timer(Duration::ZERO);
        true
    } else {
        false
    }
}

// `TIMER_ID` stays set until the run has finished, including while it waits on a lookup, so that
// only one run is ever in progress
fn start_timer(delay: Duration) {
    TIMER_ID.set(Some(ic_cdk_timers::set_timer(delay, run())));
}

async fn run() {
    trace!("'update_user_ids_in_events' job running");
    run_regular_jobs();

    if let Some((user_ids, local_user_index_canister_id)) = mutate_state(run_batch) {
        let args = local_user_index_canister::migrated_user_ids::Args {
            user_ids: user_ids.clone(),
        };
        match local_user_index_canister_c2c_client::migrated_user_ids(local_user_index_canister_id, &args).await {
            Ok(local_user_index_canister::migrated_user_ids::Response::Success(migrated)) => {
                mutate_state(|state| record_lookup(&user_ids, migrated, state))
            }
            Err(error) => {
                error!(?error, "Failed to look up migrated user ids");
                start_timer(LOOKUP_RETRY_DELAY);
                return;
            }
        }
    }

    TIMER_ID.set(None);
    read_state(start_job_if_required);
}

// Updates a batch of the events queued after a lookup if there are any, otherwise returns the next
// ids to look up if there are any, otherwise scans a batch of events
fn run_batch(state: &mut RuntimeState) -> Option<(Vec<UserId>, CanisterId)> {
    if state.data.user_ids_in_events_migration.has_events_to_update() {
        update_events(state);
        return None;
    }
    let user_ids = state
        .data
        .user_ids_in_events_migration
        .user_ids_to_look_up(MAX_USER_IDS_PER_LOOKUP);
    if !user_ids.is_empty() {
        return Some((user_ids, state.data.local_user_index_canister_id));
    }
    scan_batch(state);
    None
}

fn record_lookup(user_ids: &[UserId], migrated: HashMap<UserId, UserId>, state: &mut RuntimeState) {
    let data = &mut state.data;
    data.user_ids_in_events_migration
        .record_lookup(user_ids, &migrated, &mut data.migrated_user_ids);

    info!(
        looked_up = user_ids.len(),
        migrated = migrated.len(),
        "Looked up user ids found in events in the LocalUserIndex"
    );
}

fn scan_batch(state: &mut RuntimeState) {
    let data = &mut state.data;
    let migration = &mut data.user_ids_in_events_migration;
    scan(
        &mut data.events,
        &mut data.channels,
        migration,
        &data.migrated_user_ids,
        &mut || ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_BATCH,
    );

    if migration.is_scan_complete() {
        info!(metrics = ?migration.metrics(), "Finished scanning events for migrated user ids");
    }
}

// Scans the community's events and then each channel's, carrying on from where the last batch got
// to, until `should_stop` returns true
fn scan(
    events: &mut CommunityEvents,
    channels: &mut Channels,
    migration: &mut UserIdsInEventsMigration<EventLocation>,
    migrated_user_ids: &MigratedUserIds,
    should_stop: &mut dyn FnMut() -> bool,
) {
    let cursor = migration.scanned_up_to();
    let channel_cursor = match cursor {
        Some(EventLocation::Channel(channel_id, context)) => Some((channel_id, context)),
        _ => None,
    };

    // The community's own events are scanned first, then each channel's
    let mut scanned_up_to = None;
    if channel_cursor.is_none() {
        let after = match cursor {
            Some(EventLocation::Community(event_index)) => Some(event_index),
            _ => None,
        };
        scanned_up_to = events
            .update_user_ids(
                after,
                &mut |event_index, user_id| {
                    migration.latest_user_id(user_id, EventLocation::Community(event_index), migrated_user_ids)
                },
                should_stop,
            )
            .map(EventLocation::Community);
    }

    if scanned_up_to.is_none() {
        let mut channel_ids: Vec<ChannelId> = channels.iter().map(|c| c.id).collect();
        channel_ids.sort_unstable();

        let start_channel_id = channel_cursor.map(|(channel_id, _)| channel_id);
        for channel_id in channel_ids.into_iter().filter(|c| start_channel_id.is_none_or(|s| *c >= s)) {
            let Some(channel) = channels.get_mut(&channel_id) else {
                continue;
            };
            let after = channel_cursor.filter(|(c, _)| *c == channel_id).map(|(_, context)| context);
            if let Some(context) = channel.chat.events.update_user_ids(
                after,
                &mut |context, user_id| {
                    migration.latest_user_id(user_id, EventLocation::Channel(channel_id, context), migrated_user_ids)
                },
                should_stop,
            ) {
                scanned_up_to = Some(EventLocation::Channel(channel_id, context));
                break;
            }
        }
    }
    migration.record_scanned_up_to(scanned_up_to);
}

fn update_events(state: &mut RuntimeState) {
    let data = &mut state.data;
    let migration = &mut data.user_ids_in_events_migration;
    let migrated_user_ids = &data.migrated_user_ids;

    let mut updated = 0;
    loop {
        let events = migration.take_events_to_update(100);
        if events.is_empty() {
            break;
        }
        for location in events {
            let latest = &mut |user_id| migrated_user_ids.latest(user_id);
            let event_updated = match location {
                EventLocation::Community(event_index) => data.events.update_user_ids_in_event(event_index, latest),
                EventLocation::Channel(channel_id, context) => data
                    .channels
                    .get_mut(&channel_id)
                    .is_some_and(|channel| channel.chat.events.update_user_ids_in_event(context, latest)),
            };
            if event_updated {
                updated += 1;
            }
        }
        if ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_BATCH {
            break;
        }
    }
    migration.record_events_updated(updated);

    info!(updated, "Updated events holding user ids found to have been migrated");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::channels::Channel;
    use crate::model::events::{CommunityEventInternal, CommunityMemberJoinedInternal};
    use candid::Principal;
    use chat_events::{MessageContentInternal, NullEventPusher, PushMessageArgs, Reader, TextContentInternal};
    use group_chat_core::GroupChatCore;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use std::collections::HashSet;
    use types::{
        CommunityEvent, CommunityEventCategory, GroupPermissions, MessageId, MessageIndex, MultiUserChat, Rules, UserType,
    };

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    fn old_user_id() -> UserId {
        user_id(100)
    }

    fn new_user_id() -> UserId {
        user_id(101)
    }

    // The community has 150 events, which the migrated user created and joined under their old id
    // 149 times, and two channels with ids 5 and 2, holding 30 and 120 messages they sent under it
    fn setup() -> (CommunityEvents, Channels, MigratedUserIds) {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));

        let mut events = CommunityEvents::new("name".to_string(), "description".to_string(), old_user_id(), 0);
        for _ in 0..149 {
            events.push_event(
                CommunityEventInternal::MemberJoined(Box::new(CommunityMemberJoinedInternal {
                    user_id: old_user_id(),
                    channel_id: None,
                    invited_by: None,
                })),
                0,
            );
        }

        let mut channels = Channels::default();
        channels.add(channel(5, 30));
        channels.add(channel(2, 120));

        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(old_user_id(), new_user_id());
        (events, channels, migrated_user_ids)
    }

    fn channel(channel_id: u32, message_count: u64) -> Channel {
        let channel_id = ChannelId::from(channel_id);
        let mut chat = GroupChatCore::new(
            MultiUserChat::Channel(Principal::from_slice(&[1]).into(), channel_id),
            user_id(2),
            None,
            true,
            "name".to_string(),
            "description".to_string(),
            Rules::default(),
            None,
            None,
            true,
            false,
            GroupPermissions::default(),
            None,
            None,
            UserType::User,
            0,
            None,
            0,
        );
        for i in 0..message_count {
            chat.events.push_message::<NullEventPusher>(
                PushMessageArgs {
                    sender: old_user_id(),
                    thread_root_message_index: None,
                    message_id: MessageId::from(i),
                    content: MessageContentInternal::Text(TextContentInternal { text: "hi".to_string() }),
                    sender_context: None,
                    mentioned: Vec::new(),
                    replies_to: None,
                    forwarded: false,
                    sender_is_bot: false,
                    block_level_markdown: false,
                    og_previews: Vec::new(),
                    now: 1,
                },
                None,
            );
        }
        Channel {
            id: channel_id,
            chat,
            date_imported: None,
        }
    }

    fn senders(channels: &Channels, channel_id: u32) -> Vec<UserId> {
        let reader = channels.get(&channel_id.into()).unwrap().chat.events.main_events_reader();
        (0u32..)
            .map_while(|i| reader.message_internal(MessageIndex::from(i).into()))
            .map(|m| m.sender)
            .collect()
    }

    #[test]
    fn the_communitys_events_then_each_channels_are_scanned_a_batch_at_a_time() {
        let (mut events, mut channels, migrated_user_ids) = setup();
        let mut migration = UserIdsInEventsMigration::default();

        let mut cursors = Vec::new();
        while !migration.is_scan_complete() {
            scan(&mut events, &mut channels, &mut migration, &migrated_user_ids, &mut || true);
            cursors.push(migration.scanned_up_to());
        }

        // The community's events, then channel 2's (its first event being when it was created),
        // then channel 5's, 100 at a time, then a last batch finds nothing left to scan
        let channel = |channel_id: u32, event_index: u32| {
            Some(EventLocation::Channel(
                channel_id.into(),
                EventContext::new(None, event_index.into()),
            ))
        };
        assert_eq!(
            cursors,
            vec![
                Some(EventLocation::Community(99.into())),
                Some(EventLocation::Community(149.into())),
                channel(2, 99),
                channel(2, 120),
                channel(5, 30),
                None,
            ]
        );

        let community_events = events.get_page_events(
            community_canister::community_events::EventsPageArgs {
                start_index: 0.into(),
                ascending: true,
                max_events: 1000,
            },
            &HashSet::from([CommunityEventCategory::Details, CommunityEventCategory::Membership]),
        );
        assert_eq!(community_events.events.len(), 150);
        assert!(community_events.events.iter().all(|e| match &e.event {
            CommunityEvent::Created(c) => c.created_by == new_user_id(),
            CommunityEvent::MemberJoined(m) => m.user_id == new_user_id(),
            _ => false,
        }));
        assert_eq!(senders(&channels, 2), vec![new_user_id(); 120]);
        assert_eq!(senders(&channels, 5), vec![new_user_id(); 30]);
        // The channels' creator isn't known to have been migrated or not, so is left to be looked up
        assert_eq!(migration.user_ids_to_look_up(10), vec![user_id(2)]);
        assert!(!migration.is_complete());
    }

    #[test]
    fn the_scan_carries_on_if_the_channel_it_stopped_in_is_deleted() {
        let (mut events, mut channels, migrated_user_ids) = setup();
        let mut migration = UserIdsInEventsMigration::default();

        for _ in 0..3 {
            scan(&mut events, &mut channels, &mut migration, &migrated_user_ids, &mut || true);
        }
        assert!(matches!(migration.scanned_up_to(), Some(EventLocation::Channel(c, _)) if c == 2u32.into()));
        channels.delete(2u32.into(), 2);

        while !migration.is_scan_complete() {
            scan(&mut events, &mut channels, &mut migration, &migrated_user_ids, &mut || true);
        }

        assert_eq!(senders(&channels, 5), vec![new_user_id(); 30]);
    }
}
