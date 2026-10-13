use crate::jobs::update_user_ids_in_events;
use crate::timer_job_types::TimerJob;
use crate::{Data, RuntimeState, mutate_state, read_state, run_regular_jobs};
use group_community_common::UserIdsInStateMigration;
use ic_cdk_timers::TimerId;
use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use std::cell::Cell;
use std::collections::HashMap;
use std::ops::Deref;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{CanisterId, ChannelId, TimestampMillis, Timestamped, UserId};
use utils::mentions::replace_mentioned_users;
use utils::migrated_user_ids::MigratedUserIds;

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
// meantime. This is held back while a group's members are being imported, then restarted (see
// `on_channel_members_imported`). It can be removed once it has completed in every community.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.user_ids_in_state_migration.is_complete() && !is_held(&state.data) {
        start_timer(Duration::ZERO);
        true
    } else {
        false
    }
}

// The members of a group imported into the community are added to it a batch at a time, in order of
// user id, so moving them onto their latest ids meanwhile could make the import skip some of them,
// leaving them members of the channel but not the community. So the job waits until the members of
// every group being imported have been added, including any whose import was finalized by an
// earlier version, which are only known by their jobs still being queued.
pub(crate) fn is_held(data: &Data) -> bool {
    !data.channels_importing_members.is_empty()
        || data.timer_jobs.iter().any(|(_, job)| {
            matches!(
                job.deref().borrow().as_ref(),
                Some(TimerJob::ProcessGroupImportChannelMembers(_))
            )
        })
}

// Called once the members of a group imported into the channel have been added to the community.
// The channel's state may still hold ids which users had before being migrated to MultiUser
// canisters (eg. its former members' metrics, or those it blocked, who are now blocked from the
// community), so the community's state is passed through again.
pub(crate) fn on_channel_members_imported(data: &mut Data, channel_id: ChannelId) {
    data.channels_importing_members.remove(&channel_id);
    data.user_ids_in_state_migration.restart();
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

    mutate_state(|state| state.report_user_id_migration_progress());
    TIMER_ID.set(None);
    read_state(start_job_if_required);
}

// Returns the next ids to look up if there are any, otherwise passes through a batch of the state
fn run_batch(state: &mut RuntimeState) -> Option<(Vec<UserId>, CanisterId)> {
    if is_held(&state.data) {
        return None;
    }
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
// replaces the ids in the members' referrals and in the map of principals, which by then only hold
// old ids with nothing held under them (eg. those of invited users, whose invitations have been
// moved), unless their migrations were learned during the pass (see
// `UserIdsInStateMigration::defer`). Then each channel's ids are gathered from the heap and stable
// memory, and the channel's records under old ids moved. Those of community members are left to be
// moved along with their memberships of the community.
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
            let invited_users = &data.invited_users;
            after = data
                .members
                .update_referral_user_ids(after, STABLE_MEMORY_BATCH_SIZE, &mut |user_id, held| {
                    latest_unless_held(
                        user_id,
                        held || invited_users.contains(&user_id),
                        migration,
                        migrated_user_ids,
                    )
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
            let invited_users = &data.invited_users;
            after = data
                .members
                .update_principal_user_ids(after, STABLE_MEMORY_BATCH_SIZE, &mut |user_id, held| {
                    latest_unless_held(
                        user_id,
                        held || invited_users.contains(&user_id),
                        migration,
                        migrated_user_ids,
                    )
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
                // The channel has been deleted, so its records went with it
                migration.clear_to_move();
                return start_next_channel(data, migration, Some(channel_id), now);
            };
            loop {
                let user_ids = channel
                    .chat
                    .events
                    .user_ids_with_metrics_in_stable_memory(after, STABLE_MEMORY_BATCH_SIZE);
                for user_id in user_ids.iter() {
                    record_channel_key(*user_id, data, migration);
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
                migration.clear_to_move();
            }
            start_next_channel(data, migration, Some(channel_id), now)
        }
    }
}

// What to replace `user_id`, held as a value, with: its latest id, unless records are still held
// under it (`held`), in which case it is deferred (see `UserIdsInStateMigration::defer`)
fn latest_unless_held(
    user_id: UserId,
    held: bool,
    migration: &mut UserIdsInStateMigration<StatePosition>,
    migrated_user_ids: &MigratedUserIds,
) -> UserId {
    if held {
        migration.defer(user_id, migrated_user_ids);
        user_id
    } else {
        migration.latest_user_id(user_id, migrated_user_ids)
    }
}

// Records an id under which the channel holds a record. A community member's records in the channel
// are only moved along with their membership of the community, which moves them in every channel,
// so are deferred if the community still holds them under an old id.
fn record_channel_key(user_id: UserId, data: &Data, migration: &mut UserIdsInStateMigration<StatePosition>) {
    if data.members.contains(&user_id) {
        migration.defer(user_id, &data.migrated_user_ids);
    } else {
        migration.record_key(user_id, &data.migrated_user_ids);
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
    let channel = data.channels.get(&channel_id)?;
    for user_id in channel.chat.user_ids_holding_records() {
        record_channel_key(user_id, data, migration);
    }
    let channel = data.channels.get_mut(&channel_id)?;
    let migrated_user_ids = &data.migrated_user_ids;
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
    // The description's and rules' timestamps are moved on if they change, but neither counts towards
    // when the community was last updated, so clients only pick up the change along with the
    // community's next update, or when they next fetch its details afresh. The rules keep their
    // version, so needn't be accepted again.
    if let Some(description) = replace_mentioned_users(&data.description.value, &mut *f) {
        data.description = Timestamped::new(description, now);
    }
    if let Some(text) = replace_mentioned_users(&data.rules.text.value, &mut *f) {
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
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use std::collections::{BTreeSet, HashSet};
    use types::{BotPermissions, EventIndex, FrozenGroupInfo, MessageId, MessageIndex, UserType};

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
        let mut data = Data::new_for_tests(
            old_user_id(1),
            principal(1),
            format!("Run by @UserId({})", old_user_id(1)),
            vec![(channel_id(5), "five".to_string()), (channel_id(2), "two".to_string())],
        );
        let mut rng = StdRng::seed_from_u64(1);
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
        for stopped_at in [ChannelPosition::Metrics(None), ChannelPosition::Move] {
            let mut data = setup();
            data.migrated_user_ids = lookup();
            while data.user_ids_in_state_migration.pass_position()
                != Some(Some(StatePosition::Channel(channel_id(2), stopped_at)))
            {
                update(&mut data, NOW, &mut || true);
            }
            data.channels.delete(channel_id(2), 0);

            run_to_completion(&mut data, &mut || true);

            let channel = data.channels.get(&channel_id(5)).unwrap();
            assert_eq!(channel.chat.created_by, new_user_id(1));
            assert!(channel.chat.members.contains(&new_user_id(1)));
        }
    }

    #[test]
    fn the_job_waits_until_a_groups_members_are_imported_then_passes_through_the_state_again() {
        let mut data = setup();
        data.user_ids_in_events_migration.record_scanned_up_to(None);
        assert!(!update_user_ids_in_events::is_required(&data));
        run_to_completion(&mut data, &mut || false);
        prepare_events_migration(&mut data);
        assert!(update_user_ids_in_events::is_required(&data));

        // A group is imported into channel 5, holding the metrics of a former member under their old
        // id, and blocking another user under theirs, who is blocked from the community. The job is
        // held while the group's members are added to the community.
        data.channels_importing_members.insert(channel_id(5));
        send_message(&mut data, channel_id(5), old_user_id(6));
        data.members.block(old_user_id(8), 0);
        assert!(is_held(&data));

        on_channel_members_imported(&mut data, channel_id(5));
        assert!(!is_held(&data));
        assert!(!update_user_ids_in_events::is_required(&data));
        let (looked_up, _) = run_to_completion(&mut data, &mut || false);
        prepare_events_migration(&mut data);

        // Their migrations are already known
        assert!(looked_up.is_empty());
        let events = &data.channels.get(&channel_id(5)).unwrap().chat.events;
        assert_eq!(events.user_metrics(&new_user_id(6), None).unwrap().hydrate().text_messages, 1);
        assert!(events.user_metrics(&old_user_id(6), None).is_none());
        assert!(data.members.is_blocked(&new_user_id(8)));
        assert!(!data.members.is_blocked(&old_user_id(8)));
        assert!(update_user_ids_in_events::is_required(&data));
    }

    #[test]
    fn a_migration_learned_during_a_pass_is_only_applied_once_the_records_under_it_have_moved() {
        let mut data = setup();
        // The first lookup doesn't find user 2's migration, eg. because the LocalUserIndex hadn't yet
        // heard of it
        let mut lookup_without_user_2 = MigratedUserIds::default();
        for i in [1, 3, 4, 5, 6, 7, 8] {
            lookup_without_user_2.insert(old_user_id(i), new_user_id(i));
        }
        while data.user_ids_in_state_migration.pass_position().is_some() {
            update(&mut data, NOW, &mut || true);
        }
        let user_ids = data.user_ids_in_state_migration.user_ids_to_look_up(MAX_USER_IDS_PER_LOOKUP);
        let migrated = lookup_without_user_2.get_many(user_ids.iter().copied());
        data.user_ids_in_state_migration
            .record_lookup(&user_ids, &migrated, &mut data.migrated_user_ids);

        // During the next pass, once the community's records have been moved, user 2's migration is
        // learned, eg. by events for them being sent on to their latest id
        while data.user_ids_in_state_migration.pass_position() != Some(Some(StatePosition::Referrals(None))) {
            update(&mut data, NOW, &mut || true);
        }
        data.migrated_user_ids.insert(old_user_id(2), new_user_id(2));
        while matches!(data.user_ids_in_state_migration.pass_position(), Some(Some(_))) {
            update(&mut data, NOW, &mut || true);
        }

        // Nothing has been pointed at their latest id while their records are still under their old
        // id, so their principal still leads to their membership, and their membership of channel 2
        // hasn't been moved apart from their membership of the community
        assert!(data.members.contains(&old_user_id(2)));
        assert_eq!(data.members.lookup_user_id(principal(2)), Some(old_user_id(2)));
        let member1 = data.members.get_by_user_id(&new_user_id(1)).unwrap();
        assert_eq!(member1.referrals(), &BTreeSet::from([old_user_id(2)]));
        let channel = data.channels.get(&channel_id(2)).unwrap();
        assert!(channel.chat.members.contains(&old_user_id(2)));
        assert!(!channel.chat.members.contains(&new_user_id(2)));

        // Another pass is made, with nothing to look up, which moves them
        assert_eq!(data.user_ids_in_state_migration.pass_position(), Some(None));
        let (looked_up, _) = run_to_completion(&mut data, &mut || false);
        assert!(looked_up.is_empty());
        assert_every_old_id_replaced(&data);
    }
}
