use crate::jobs::update_user_ids_in_events;
use crate::{Data, RuntimeState, mutate_state, read_state, run_regular_jobs};
use group_community_common::UserIdsInStateMigration;
use ic_cdk_timers::TimerId;
use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use std::cell::Cell;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{CanisterId, ChannelId, TimestampMillis, Timestamped, UserId};
use utils::mentions::replace_mentioned_users;

const MAX_INSTRUCTIONS_PER_BATCH: u64 = 2_000_000_000;
const MAX_USER_IDS_PER_LOOKUP: usize = 5_000;
const LOOKUP_RETRY_DELAY: Duration = Duration::from_secs(60);
// How many entries in stable memory are read at a time, the instructions used being checked after
// each batch
const STABLE_MEMORY_BATCH_SIZE: usize = 100;

// Where a pass through the community's state has got to (see `step`)
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum StatePosition {
    // Moving the community's records held under the ids users had before being migrated onto their
    // latest ids, along with their memberships of channels, etc (see `Data::migrate_user_id`)
    #[serde(rename = "v")]
    Move,
    // The members' referrals in stable memory, after the given member
    #[serde(rename = "r")]
    Referrals(Option<UserId>),
    // The map of principals to user ids, after the given principal
    #[serde(rename = "p")]
    Principals(Option<Principal>),
    // Within the given channel
    #[serde(rename = "c")]
    Channel(ChannelId, ChannelPosition),
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ChannelPosition {
    // The channel's users' metrics in stable memory, after the given user
    #[serde(rename = "m")]
    Metrics(Option<UserId>),
    // Moving the channel's records held under old ids onto the users' latest ids
    #[serde(rename = "v")]
    Move,
}

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Replaces the ids users had before being migrated to MultiUser canisters with their latest ids
// throughout the community's state other than its events (see `UserIdsInStateMigration`), going
// through the community's own state and then each channel's, in order of id. Each run either looks
// up a batch of the ids found in the LocalUserIndex, or passes through as much of the state as it
// can. Once complete, the job which does the same for the community's events is started, from the
// start if it had already begun, so that it also catches any old ids written into events in the
// meantime. This is restarted when a group is imported. It can be removed once it has completed in
// every community.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.user_ids_in_state_migration.is_complete() {
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
    trace!("'update_user_ids_in_state' job running");
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

// Returns the next ids to look up if there are any, otherwise passes through a batch of the state
fn run_batch(state: &mut RuntimeState) -> Option<(Vec<UserId>, CanisterId)> {
    let user_ids = state
        .data
        .user_ids_in_state_migration
        .user_ids_to_look_up(MAX_USER_IDS_PER_LOOKUP);
    if !user_ids.is_empty() {
        return Some((user_ids, state.data.local_user_index_canister_id));
    }

    let now = state.env.now();
    update(&mut state.data, now, &mut || {
        ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_BATCH
    });

    if state.data.user_ids_in_state_migration.is_complete() {
        info!(
            metrics = ?state.data.user_ids_in_state_migration.metrics(),
            "Finished replacing migrated user ids in the community's state"
        );
        prepare_events_migration(&mut state.data);
        update_user_ids_in_events::start_job_if_required(state);
    }
    None
}

fn record_lookup(user_ids: &[UserId], migrated: HashMap<UserId, UserId>, state: &mut RuntimeState) {
    let data = &mut state.data;
    data.user_ids_in_state_migration
        .record_lookup(user_ids, &migrated, &mut data.migrated_user_ids);

    info!(
        looked_up = user_ids.len(),
        migrated = migrated.len(),
        "Looked up user ids found in the community's state in the LocalUserIndex"
    );
}

// The events may have been scanned while this job was running, during which old ids could still be
// written into new events, so if the scan had begun it starts again
fn prepare_events_migration(data: &mut Data) {
    let events_migration = &mut data.user_ids_in_events_migration;
    if events_migration.scanned_up_to().is_some() || events_migration.is_scan_complete() {
        events_migration.restart_scan();
    }
}

// Carries on passing through the state, a step at a time, until `should_stop` returns true or the
// pass has finished. The migration is taken out of `data` meanwhile, so that both can be updated.
fn update(data: &mut Data, now: TimestampMillis, should_stop: &mut dyn FnMut() -> bool) {
    let mut migration = std::mem::take(&mut data.user_ids_in_state_migration);
    while let Some(position) = migration.pass_position() {
        let next = step(data, &mut migration, position, now, should_stop);
        migration.record_position(next);
        if should_stop() {
            break;
        }
    }
    data.user_ids_in_state_migration = migration;
}

// Takes one step through the state from `position`, returning where the next carries on from, None
// once the pass has finished. A pass gathers the ids in the community's own state on the heap first,
// then moves the records held under old ids, which moves their memberships of channels too, then
// replaces the ids in the members' referrals and in the map of principals, which by then only points
// at old ids for those who aren't members (eg. invited users). Then each channel's ids are gathered
// from the heap and stable memory, and the records under old ids moved.
fn step(
    data: &mut Data,
    migration: &mut UserIdsInStateMigration<StatePosition>,
    position: Option<StatePosition>,
    now: TimestampMillis,
    should_stop: &mut dyn FnMut() -> bool,
) -> Option<StatePosition> {
    match position {
        None => {
            update_community_heap(data, migration, now);
            Some(StatePosition::Move)
        }
        Some(StatePosition::Move) => {
            while let Some(old_user_id) = migration.take_next_to_move() {
                let latest = data.migrated_user_ids.latest(old_user_id);
                if data.migrate_user_id(old_user_id, latest, None, now) {
                    migration.record_moved();
                }
                if should_stop() {
                    return Some(StatePosition::Move);
                }
            }
            Some(StatePosition::Referrals(None))
        }
        Some(StatePosition::Referrals(mut after)) => loop {
            let migrated_user_ids = &data.migrated_user_ids;
            after = data
                .members
                .update_referral_user_ids(after, STABLE_MEMORY_BATCH_SIZE, &mut |user_id| {
                    migration.latest_user_id(user_id, migrated_user_ids)
                });
            if after.is_none() {
                return Some(StatePosition::Principals(None));
            }
            if should_stop() {
                return Some(StatePosition::Referrals(after));
            }
        },
        Some(StatePosition::Principals(mut after)) => loop {
            let migrated_user_ids = &data.migrated_user_ids;
            after = data
                .members
                .update_principal_user_ids(after, STABLE_MEMORY_BATCH_SIZE, &mut |user_id| {
                    migration.latest_user_id(user_id, migrated_user_ids)
                });
            if after.is_none() {
                return start_next_channel(data, migration, None, now);
            }
            if should_stop() {
                return Some(StatePosition::Principals(after));
            }
        },
        Some(StatePosition::Channel(channel_id, ChannelPosition::Metrics(mut after))) => {
            let Some(channel) = data.channels.get(&channel_id) else {
                return start_next_channel(data, migration, Some(channel_id), now);
            };
            loop {
                let user_ids = channel
                    .chat
                    .events
                    .user_ids_with_metrics_in_stable_memory(after, STABLE_MEMORY_BATCH_SIZE);
                for user_id in user_ids.iter() {
                    migration.record_key(*user_id, &data.migrated_user_ids);
                }
                if user_ids.len() < STABLE_MEMORY_BATCH_SIZE {
                    return Some(StatePosition::Channel(channel_id, ChannelPosition::Move));
                }
                after = user_ids.last().copied();
                if should_stop() {
                    return Some(StatePosition::Channel(channel_id, ChannelPosition::Metrics(after)));
                }
            }
        }
        Some(StatePosition::Channel(channel_id, ChannelPosition::Move)) => {
            if let Some(channel) = data.channels.get_mut(&channel_id) {
                while let Some(old_user_id) = migration.take_next_to_move() {
                    let latest = data.migrated_user_ids.latest(old_user_id);
                    if channel.chat.migrate_user_id(old_user_id, latest, now) {
                        migration.record_moved();
                    }
                    if should_stop() {
                        return Some(StatePosition::Channel(channel_id, ChannelPosition::Move));
                    }
                }
            } else {
                // The channel has been deleted, so its records went with it
                while migration.take_next_to_move().is_some() {}
            }
            start_next_channel(data, migration, Some(channel_id), now)
        }
    }
}

// Starts on the first channel after `after`, gathering the ids held on its heap, or returns None if
// there are no more channels, which finishes the pass
fn start_next_channel(
    data: &mut Data,
    migration: &mut UserIdsInStateMigration<StatePosition>,
    after: Option<ChannelId>,
    now: TimestampMillis,
) -> Option<StatePosition> {
    let channel_id = data
        .channels
        .iter()
        .map(|c| c.id)
        .filter(|id| after.is_none_or(|a| *id > a))
        .min()?;
    let channel = data.channels.get_mut(&channel_id)?;
    let migrated_user_ids = &data.migrated_user_ids;
    for user_id in channel.chat.user_ids_holding_records() {
        migration.record_key(user_id, migrated_user_ids);
    }
    channel
        .chat
        .update_user_ids_outside_records(&mut |user_id| migration.latest_user_id(user_id, migrated_user_ids), now);
    Some(StatePosition::Channel(channel_id, ChannelPosition::Metrics(None)))
}

// Queues the community's records on the heap which are held under old ids to be moved (see
// `Data::migrate_user_id`), and replaces the old ids held as values
fn update_community_heap(data: &mut Data, migration: &mut UserIdsInStateMigration<StatePosition>, now: TimestampMillis) {
    let migrated_user_ids = &data.migrated_user_ids;
    for user_id in data
        .members
        .user_ids_holding_records()
        .chain(data.invited_users.user_ids_and_inviters())
        .chain(data.expiring_members.user_ids())
        .chain(data.expiring_member_actions.user_ids())
        .chain(data.achievements.user_ids())
        .chain(data.user_cache.user_ids())
    {
        migration.record_key(user_id, migrated_user_ids);
    }

    let f = &mut |user_id| migration.latest_user_id(user_id, migrated_user_ids);
    data.bots.update_added_by(f, now);
    if let Some(frozen) = data.frozen.value.as_mut() {
        frozen.frozen_by = f(frozen.frozen_by);
    }
    data.total_payment_receipts.update_user_ids(f);
    // The rules keep their version, so needn't be accepted again
    if let Some(description) = replace_mentioned_users(&data.description.value, f) {
        data.description = Timestamped::new(description, now);
    }
    if let Some(text) = replace_mentioned_users(&data.rules.text.value, f) {
        let mut rules = data.rules.value.clone();
        rules.text.value = text;
        data.rules = Timestamped::new(rules, now);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::invited_users::UserInvitation;
    use chat_events::{MessageContentInternal, NullEventPusher, PushMessageArgs, TextContentInternal};
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use std::collections::{BTreeSet, HashSet};
    use types::{BotPermissions, CommunityPermissions, EventIndex, FrozenGroupInfo, MessageId, MessageIndex, Rules, UserType};
    use utils::migrated_user_ids::MigratedUserIds;

    const NOW: TimestampMillis = 1_000;

    fn canister_id(i: u8) -> CanisterId {
        CanisterId::from_slice(&[0, 0, 0, 0, 0, 0, 0, i, 1, 1])
    }

    // The User canister ids migrated users had, and the ids they were migrated to
    fn old_user_id(i: u8) -> UserId {
        canister_id(100 + i).into()
    }

    fn new_user_id(i: u8) -> UserId {
        UserId::new_indexed(canister_id(1), i as u16)
    }

    fn principal(i: u8) -> Principal {
        Principal::from_slice(&[i])
    }

    // A bot, whose id is unindexed but was never migrated
    fn bot_id() -> UserId {
        canister_id(50).into()
    }

    fn channel_id(i: u32) -> ChannelId {
        ChannelId::from(i)
    }

    // The migrations the LocalUserIndex knows of
    fn lookup() -> MigratedUserIds {
        let mut lookup = MigratedUserIds::default();
        for i in 1..=8 {
            lookup.insert(old_user_id(i), new_user_id(i));
        }
        lookup
    }

    // Migrated user 1 created the community, along with channels 5 and 2, mentions themselves in its
    // description, installed a bot and invited user 4. Migrated user 2 is a member referred by user
    // 1, in a user group with them, a member of channel 2, mentioned in its description, and paid to
    // join. User 3 is blocked, user 5 froze the community, and user 6 is a former member of channel 2
    // who sent a message there. User 7 is a member under their latest id, referred by migrated user
    // 8, who has since left.
    fn setup() -> Data {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));

        let mut rng = StdRng::seed_from_u64(1);
        let mut data = Data::new(
            Principal::from_slice(&[200]).into(),
            principal(1),
            old_user_id(1),
            UserType::User,
            true,
            "name".to_string(),
            format!("Run by @UserId({})", old_user_id(1)),
            Rules::default(),
            None,
            None,
            CommunityPermissions::default(),
            "en".to_string(),
            canister_id(10),
            canister_id(11),
            canister_id(12),
            canister_id(13).into(),
            canister_id(14),
            canister_id(15),
            None,
            vec![(channel_id(5), "five".to_string()), (channel_id(2), "two".to_string())],
            None,
            0,
            Vec::new(),
            true,
            &mut rng,
            0,
        );
        data.members
            .add(old_user_id(2), principal(2), UserType::User, Some(old_user_id(1)), 0);
        data.members
            .add(new_user_id(7), principal(7), UserType::User, Some(old_user_id(8)), 0);
        data.members
            .create_user_group("group".to_string(), vec![old_user_id(1), old_user_id(2)], &mut rng, 0)
            .unwrap();
        data.members.block(old_user_id(3), 0);
        data.invited_users.add(
            old_user_id(4),
            UserInvitation {
                invited_by: old_user_id(1),
                timestamp: 0,
            },
        );
        data.members.add_user_id(principal(4), old_user_id(4));
        data.bots
            .add(bot_id(), old_user_id(1), BotPermissions::default(), None, None, 0);
        data.total_payment_receipts.add(canister_id(20), 100, old_user_id(2));
        data.frozen = Timestamped::new(
            Some(FrozenGroupInfo {
                timestamp: 0,
                frozen_by: old_user_id(5),
                reason: None,
            }),
            0,
        );

        let channel = data.channels.get_mut(&channel_id(2)).unwrap();
        channel.chat.description = Timestamped::new(format!("Ask @UserId({})", old_user_id(2)), 0);
        for user_id in [old_user_id(2), old_user_id(6)] {
            channel.chat.members.add(
                user_id,
                None,
                0,
                EventIndex::default(),
                MessageIndex::default(),
                false,
                UserType::User,
            );
        }
        send_message(&mut data, channel_id(2), old_user_id(6));
        let channel = data.channels.get_mut(&channel_id(2)).unwrap();
        channel.chat.members.remove(old_user_id(6), 0);
        data.members.mark_member_joined_channel(old_user_id(2), channel_id(2));
        data
    }

    fn send_message(data: &mut Data, channel_id: ChannelId, sender: UserId) {
        data.channels
            .get_mut(&channel_id)
            .unwrap()
            .chat
            .events
            .push_message::<NullEventPusher>(
                PushMessageArgs {
                    sender,
                    thread_root_message_index: None,
                    message_id: MessageId::from(1u64),
                    content: MessageContentInternal::Text(TextContentInternal { text: "hi".to_string() }),
                    sender_context: None,
                    mentioned: Vec::new(),
                    replies_to: None,
                    forwarded: false,
                    sender_is_bot: false,
                    block_level_markdown: false,
                    og_previews: Vec::new(),
                    now: 0,
                },
                None,
            );
    }

    // Runs the job until it is complete, a single step at a time if `should_stop` always returns
    // true, each lookup finding the migrations in `lookup`, and returns the ids looked up and the
    // positions reached after each step
    fn run_to_completion(
        data: &mut Data,
        should_stop: &mut dyn FnMut() -> bool,
    ) -> (HashSet<UserId>, Vec<Option<Option<StatePosition>>>) {
        let lookup = lookup();
        let mut looked_up = HashSet::new();
        let mut positions = Vec::new();
        while !data.user_ids_in_state_migration.is_complete() {
            let user_ids = data.user_ids_in_state_migration.user_ids_to_look_up(MAX_USER_IDS_PER_LOOKUP);
            if user_ids.is_empty() {
                update(data, NOW, should_stop);
                positions.push(data.user_ids_in_state_migration.pass_position());
            } else {
                let migrated = lookup.get_many(user_ids.iter().copied());
                data.user_ids_in_state_migration
                    .record_lookup(&user_ids, &migrated, &mut data.migrated_user_ids);
                looked_up.extend(user_ids);
            }
        }
        (looked_up, positions)
    }

    fn assert_every_old_id_replaced(data: &Data) {
        let members = &data.members;
        for user_id in [new_user_id(1), new_user_id(2), new_user_id(7)] {
            assert!(members.contains(&user_id));
        }
        assert_eq!(members.len(), 3);
        assert_eq!(members.owners().iter().copied().collect::<Vec<_>>(), vec![new_user_id(1)]);
        assert_eq!(members.blocked(), vec![new_user_id(3)]);
        let member1 = members.get_by_user_id(&new_user_id(1)).unwrap();
        assert_eq!(member1.referrals(), &BTreeSet::from([new_user_id(2)]));
        let member2 = members.get_by_user_id(&new_user_id(2)).unwrap();
        assert_eq!(member2.referred_by, Some(new_user_id(1)));
        assert!(members.channels_for_member(new_user_id(2)).contains(&channel_id(2)));
        let member7 = members.get_by_user_id(&new_user_id(7)).unwrap();
        assert_eq!(member7.referred_by, Some(new_user_id(8)));
        let user_group = members.iter_user_groups().next().unwrap();
        assert_eq!(user_group.members.value, HashSet::from([new_user_id(1), new_user_id(2)]));
        for i in [1, 2, 4, 7] {
            assert_eq!(members.lookup_user_id(principal(i)), Some(new_user_id(i)));
        }

        assert_eq!(data.invited_users.get(&new_user_id(4)).unwrap().invited_by, new_user_id(1));
        assert_eq!(data.invited_users.len(), 1);
        assert_eq!(data.description.value, format!("Run by @UserId({})", new_user_id(1)));
        assert_eq!(data.bots.get(&bot_id()).unwrap().added_by, new_user_id(1));
        assert_eq!(data.frozen.value.as_ref().unwrap().frozen_by, new_user_id(5));
        let mut receipts = data.total_payment_receipts.clone();
        assert!(!receipts.update_user_ids(&mut |user_id| {
            assert_ne!(user_id, old_user_id(2));
            user_id
        }));

        for channel in data.channels.iter() {
            assert_eq!(channel.chat.created_by, new_user_id(1));
            assert!(channel.chat.members.contains(&new_user_id(1)));
            assert!(channel.chat.members.member_ids().iter().all(|u| u.is_indexed()));
        }
        let channel = data.channels.get(&channel_id(2)).unwrap();
        assert!(channel.chat.members.contains(&new_user_id(2)));
        assert_eq!(channel.chat.description.value, format!("Ask @UserId({})", new_user_id(2)));
        let events = &channel.chat.events;
        assert_eq!(events.user_metrics(&new_user_id(6), None).unwrap().hydrate().text_messages, 1);
        assert!(events.user_metrics(&old_user_id(6), None).is_none());
    }

    #[test]
    fn every_old_id_in_the_state_is_replaced() {
        let mut data = setup();

        let (looked_up, _) = run_to_completion(&mut data, &mut || false);

        // Each unindexed id was looked up once, but not the latest ids, nor the installed bot's, which
        // is only a key of the installed bots
        let expected: HashSet<_> = (1..=8).filter(|i| *i != 7).map(old_user_id).collect();
        assert_eq!(looked_up, expected);
        assert_every_old_id_replaced(&data);
        assert_eq!(data.user_ids_in_state_migration.metrics().passes_completed, 2);
    }

    #[test]
    fn the_communitys_state_then_each_channels_is_passed_through_a_step_at_a_time() {
        let mut data = setup();
        data.migrated_user_ids = lookup();

        let (looked_up, positions) = run_to_completion(&mut data, &mut || true);

        // Every migration was known, so a single pass replaced them all
        assert!(looked_up.is_empty());
        assert_every_old_id_replaced(&data);
        // Gathering the ids on the community's heap takes a step, then moving its records a step for
        // each of users 1 to 4, then moving channel 2's a step for user 6
        let channel = |channel_id: u32, position| Some(Some(StatePosition::Channel(channel_id.into(), position)));
        let pass = vec![
            Some(Some(StatePosition::Move)),
            Some(Some(StatePosition::Move)),
            Some(Some(StatePosition::Move)),
            Some(Some(StatePosition::Move)),
            Some(Some(StatePosition::Move)),
            Some(Some(StatePosition::Referrals(None))),
            Some(Some(StatePosition::Principals(None))),
            channel(2, ChannelPosition::Metrics(None)),
            channel(2, ChannelPosition::Move),
            channel(2, ChannelPosition::Move),
            channel(5, ChannelPosition::Metrics(None)),
            channel(5, ChannelPosition::Move),
            None,
        ];
        assert_eq!(positions, pass);
    }

    #[test]
    fn the_pass_carries_on_if_the_channel_it_stopped_in_is_deleted() {
        let mut data = setup();
        data.migrated_user_ids = lookup();
        while data.user_ids_in_state_migration.pass_position()
            != Some(Some(StatePosition::Channel(channel_id(2), ChannelPosition::Move)))
        {
            update(&mut data, NOW, &mut || true);
        }
        data.channels.delete(channel_id(2), 0);

        run_to_completion(&mut data, &mut || true);

        let channel = data.channels.get(&channel_id(5)).unwrap();
        assert_eq!(channel.chat.created_by, new_user_id(1));
        assert!(channel.chat.members.contains(&new_user_id(1)));
    }

    #[test]
    fn restarting_passes_through_the_state_again_and_holds_back_the_events_job() {
        let mut data = setup();
        data.user_ids_in_events_migration.record_scanned_up_to(None);
        assert!(!update_user_ids_in_events::is_required(&data));
        run_to_completion(&mut data, &mut || false);
        prepare_events_migration(&mut data);
        assert!(update_user_ids_in_events::is_required(&data));

        // A channel member is added under an old id, as when a group is imported
        let channel = data.channels.get_mut(&channel_id(5)).unwrap();
        channel.chat.members.add(
            old_user_id(6),
            None,
            0,
            EventIndex::default(),
            MessageIndex::default(),
            false,
            UserType::User,
        );
        data.user_ids_in_state_migration.restart();
        assert!(!update_user_ids_in_events::is_required(&data));

        let (looked_up, _) = run_to_completion(&mut data, &mut || false);
        prepare_events_migration(&mut data);

        // Its migration is already known
        assert!(looked_up.is_empty());
        let channel = data.channels.get(&channel_id(5)).unwrap();
        assert!(channel.chat.members.contains(&new_user_id(6)));
        assert!(!channel.chat.members.contains(&old_user_id(6)));
        assert!(update_user_ids_in_events::is_required(&data));
    }
}
