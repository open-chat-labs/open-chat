use crate::activity_notifications::extract_activity;
use crate::jobs::{unlapse_members, update_user_ids_in_events, update_user_ids_in_state};
use crate::model::channels::Channel;
use crate::model::events::{CommunityEventInternal, GroupImportedInternal};
use crate::model::groups_being_imported::{GroupToImport, GroupToImportAction};
use crate::model::members::{AddResult, CommunityMembers, MembersToAdd};
use crate::timer_job_types::{
    FinalizeGroupImportJob, JoinMembersToPublicChannelJob, MarkGroupImportCompleteJob, ProcessGroupImportChannelMembersJob,
    TimerJob,
};
use crate::{Data, RuntimeState, mutate_state, read_state, run_regular_jobs};
use chat_events::{ChatEvents, ChatEventsExport};
use constants::{OPENCHAT_BOT_USER_ID, SECOND_IN_MS};
use group_canister::c2c_export_group::{Args, ExportExtras, Response};
use group_chat_core::{GroupChatCore, GroupMembers};
use ic_cdk::call::RejectCode;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::collections::{BTreeMap, HashMap};
use std::ops::{Bound, Deref};
use std::time::Duration;
use tracing::{error, info, trace};
use types::{
    C2CError, Caller, CanisterId, ChannelId, ChannelLatestMessageIndex, Chat, ChatId, CommunityUsersBlocked, Empty,
    Milliseconds, MultiUserChat, UserId, UserIdAndPrincipal, UserType,
};

const PAGE_SIZE: u32 = 19 * 102 * 1024; // Roughly 1.9MB (1.9 * 1024 * 1024)
// The most of an imported group's members who aren't yet members of the community to add at a time
// (in test mode, few enough that a test's group needs several batches)
const IMPORT_MEMBERS_BATCH_SIZE: usize = 1000;
const IMPORT_MEMBERS_BATCH_SIZE_TEST_MODE: usize = 2;
// Each retry of a batch whose members' principals couldn't be got waits this much longer than the last
const IMPORT_MEMBERS_RETRY_INTERVAL: Milliseconds = 10 * SECOND_IN_MS;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.groups_being_imported.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'import_groups' job running");
    TIMER_ID.set(None);
    run_regular_jobs();

    let batch = mutate_state(next_batch);
    if !batch.is_empty() {
        utils::async_work::spawn_tracked(import_groups(batch));
    }
}

fn next_batch(state: &mut RuntimeState) -> Vec<GroupToImport> {
    let now = state.env.now();
    state.data.groups_being_imported.next_batch(now)
}

async fn import_groups(groups: Vec<GroupToImport>) {
    futures::future::join_all(groups.into_iter().map(import_group)).await;
    read_state(start_job_if_required);
}

async fn import_group(group: GroupToImport) {
    let group_id = group.group_id;
    let action = group.action;
    info!(%group_id, ?action, "'import_group' starting");
    match action {
        GroupToImportAction::Core(from) => {
            match group_canister_c2c_client::c2c_export_group(
                group_id.into(),
                &Args {
                    from,
                    page_size: PAGE_SIZE,
                },
            )
            .await
            {
                Ok(Response::Success(bytes)) => {
                    mutate_state(|state| {
                        if state.data.groups_being_imported.mark_batch_complete(&group_id, &bytes) {
                            let now = state.env.now();

                            state.data.timer_jobs.enqueue_job(
                                TimerJob::FinalizeGroupImport(FinalizeGroupImportJob { group_id }),
                                now,
                                now,
                            );

                            // We set a timer to trigger an upgrade in case deserializing the group requires
                            // more instructions than are allowed in a normal update call
                            ic_cdk_timers::set_timer(Duration::from_secs(10), async move {
                                run_regular_jobs();
                                trigger_upgrade_to_finalize_import(group_id)
                            });

                            info!(%group_id, "Group data imported");
                        }
                    });
                }
                Err(error) => {
                    mutate_state(|state| {
                        if is_unrecoverable(&error) {
                            state.data.groups_being_imported.take(&group_id);
                        } else {
                            state
                                .data
                                .groups_being_imported
                                .mark_batch_failed(&group_id, format!("{error:?}"));
                        }
                    });
                }
            }
        }
        GroupToImportAction::Events(channel_id, after) => {
            match group_canister_c2c_client::c2c_export_group_events(
                group_id.into(),
                &group_canister::c2c_export_group_events::Args { after },
            )
            .await
            {
                Ok(group_canister::c2c_export_group_events::Response::Success(result)) => {
                    mutate_state(|state| {
                        if let Some((up_to, _)) = result.events.last() {
                            state.data.groups_being_imported.mark_events_batch_complete(&group_id, *up_to);
                        }
                        if result.finished {
                            state.data.groups_being_imported.mark_events_import_complete(&group_id);
                        }
                        ChatEvents::import_events(Chat::Channel(state.env.canister_id().into(), channel_id), result.events);
                        info!(%group_id, "Group events imported");
                    });
                }
                Err(error) => {
                    mutate_state(|state| {
                        state
                            .data
                            .groups_being_imported
                            .mark_batch_failed(&group_id, format!("{error:?}"));
                    });
                }
            }
        }
        GroupToImportAction::Members(channel_id, after) => {
            match group_canister_c2c_client::c2c_export_group_members(
                group_id.into(),
                &group_canister::c2c_export_group_members::Args { after },
            )
            .await
            {
                Ok(group_canister::c2c_export_group_members::Response::Success(result)) => {
                    mutate_state(|state| {
                        let up_to = GroupMembers::write_members_from_bytes_to_stable_memory(
                            MultiUserChat::Channel(state.env.canister_id().into(), channel_id),
                            result.members,
                        );
                        if let Some(user_id) = up_to {
                            state
                                .data
                                .groups_being_imported
                                .mark_members_batch_complete(&group_id, user_id);
                        }
                        if result.finished {
                            state.data.groups_being_imported.mark_members_import_complete(&group_id);
                        }
                        info!(%group_id, "Group members imported");
                    });
                }
                Err(error) => {
                    mutate_state(|state| {
                        state
                            .data
                            .groups_being_imported
                            .mark_batch_failed(&group_id, format!("{error:?}"));
                    });
                }
            }
        }
    }
}

pub(crate) fn finalize_group_import(group_id: ChatId) {
    info!(%group_id, "'finalize_group_import' starting");
    let initial_instruction_count = ic_cdk::api::instruction_counter();

    mutate_state(|state| {
        if let Some(group) = state.data.groups_being_imported.take(&group_id) {
            let now = state.env.now();
            let community_id = state.env.canister_id().into();
            let channel_id = group.channel_id();

            let mut bytes = group.bytes();
            let mut chat: GroupChatCore = msgpack::deserialize(&mut bytes).unwrap();
            // A group on the previous version exported its users' metrics and message event indexes
            // on the heap rather than in the extras. Its metrics would be lost, and this canister
            // wouldn't upgrade while the message event indexes stayed on the heap (see
            // `ChatEvents::legacy_heap_entries`). Group is released before Community so that this
            // doesn't happen.
            let legacy_heap_entries = chat.events.legacy_heap_entries();
            if legacy_heap_entries > 0 {
                error!(%group_id, legacy_heap_entries, "The group's export held chat events data on the heap");
            }
            // The extras carry the users' metrics and message event indexes, without which lookups by
            // message index would fail, so every group on the current version sends them. This also
            // runs in `post_upgrade`, so failing to deserialize them mustn't trap.
            let extras: ExportExtras = if bytes.is_empty() {
                ExportExtras::default()
            } else {
                msgpack::deserialize(bytes).unwrap_or_else(|error| {
                    error!(%group_id, ?error, "Failed to deserialize the group's export extras");
                    ExportExtras::default()
                })
            };
            for (old_user_id, new_user_id) in extras.migrated_user_ids {
                state.data.migrated_user_ids.insert(old_user_id, new_user_id);
            }

            chat.events.set_chat(Chat::Channel(community_id, channel_id));
            chat.members.set_chat(MultiUserChat::Channel(community_id, channel_id));
            // The message ids, expiring events and search index were written to stable memory as the
            // events were imported, and the users' metrics and message event indexes, which the group
            // exported alongside its chat, are written under the channel's prefixes now
            chat.events.import_from_group(ChatEventsExport {
                user_metrics: extras.user_metrics,
                message_event_index_chunks: extras.message_event_index_chunks,
            });

            let blocked: Vec<_> = chat.members.blocked();
            if !blocked.is_empty() {
                let mut blocked_from_community = Vec::new();

                // We don't (currently) support blocking/unblocking members at the channel level, so we unblock users
                // from the channel and instead block them from the community (unless they were already in the
                // community).
                for user_id in blocked {
                    chat.members.unblock(user_id, now);

                    // If the user is not already a member of the community, block them from the community
                    if state.data.members.get_by_user_id(&user_id).is_none() && state.data.members.block(user_id, now) {
                        blocked_from_community.push(user_id);
                    }
                }
                if !blocked_from_community.is_empty() {
                    state.push_community_event(CommunityEventInternal::UsersBlocked(Box::new(CommunityUsersBlocked {
                        user_ids: blocked_from_community,
                        blocked_by: OPENCHAT_BOT_USER_ID,
                        referred_by: HashMap::new(),
                    })));
                }
            }

            state.data.channels.add(Channel {
                id: channel_id,
                chat,
                date_imported: None, // This is only set once everything is complete
            });

            // The group may have been unlapsing its members when it was exported
            unlapse_members::start_job_if_required(state);
            // The job which replaces the ids users had before being migrated to MultiUser canisters
            // throughout the community's state waits until the channel's members have been added to
            // the community (see `update_user_ids_in_state::is_held`)
            state.data.channels_importing_members.insert(channel_id);
            // The channel's events may still hold ids which users had before being migrated to
            // MultiUser canisters, so are scanned for them, from the start if the scan has passed it
            let migration = &mut state.data.user_ids_in_events_migration;
            if migration.is_scan_complete()
                || matches!(migration.scanned_up_to(), Some(update_user_ids_in_events::EventLocation::Channel(c, _)) if c > channel_id)
            {
                migration.restart_scan();
            }
            update_user_ids_in_events::start_job_if_required(state);

            state.data.timer_jobs.enqueue_job(
                TimerJob::ProcessGroupImportChannelMembers(ProcessGroupImportChannelMembersJob {
                    group_id,
                    channel_id,
                    attempt: 0,
                    after: None,
                    members_added: Vec::new(),
                }),
                now,
                now,
            );
        }
    });

    let instruction_count = ic_cdk::api::instruction_counter() - initial_instruction_count;
    info!(%group_id, instruction_count, "'finalize_group_import' completed");
}

// The channel's members are processed a batch at a time, in order of user id:
// 1. For channel members already in the community, add the new channel to their set of channels.
// 2. For channel members who are not yet community members, lookup their latest ids and principals,
// then join them to the community, add the new channel to their set of channels, and add them to the
// community's other public channels (via `JoinMembersToPublicChannelJob`). A member the group held by
// an id they've since been migrated from is moved onto their latest id, as when the community is told
// of a migration, which the group, being deleted once imported, won't be.
// Once every batch has been processed, if the channel is public, the community members not in it
// are added to it.
pub(crate) async fn process_channel_members(mut job: ProcessGroupImportChannelMembersJob) {
    let group_id = job.group_id;
    let channel_id = job.channel_id;
    info!(%group_id, attempt = job.attempt, after = ?job.after, "'process_channel_members' starting");

    let (batch, scanned_to, local_user_index_canister_id) = mutate_state(|state| next_batch_of_channel_members(&job, state));

    if batch.is_empty() {
        complete_processing_channel_members(group_id, channel_id, job.members_added);
        return;
    }

    let c2c_args = local_user_index_canister::c2c_user_principals_v2::Args {
        user_ids: batch.keys().copied().collect(),
    };
    let response = local_user_index_canister_c2c_client::c2c_user_principals_v2(local_user_index_canister_id, &c2c_args).await;

    mutate_state(|state| {
        let now = state.env.now();

        if let Ok(local_user_index_canister::c2c_user_principals_v2::Response::Success(users)) = response {
            // In order of user id
            let users: BTreeMap<_, _> = users.into_iter().collect();

            let ChannelMembersBatch {
                to_add,
                mut to_remove,
                migrated,
            } = plan_batch_of_channel_members(users, &batch, &state.data.members);

            let mut added = Vec::new();
            for (user_id, result) in state.data.members.add_many(to_add, now) {
                match result {
                    AddResult::Success(_) => {
                        state.data.invited_users.remove(&user_id, now);
                        state.data.members.mark_member_joined_channel(user_id, channel_id);
                        added.push(user_id);
                    }
                    AddResult::AlreadyInCommunity => {
                        state.data.members.mark_member_joined_channel(user_id, channel_id);
                    }
                    AddResult::Blocked => to_remove.push(user_id),
                }
            }

            // The channel may have been deleted while its members were being imported, in which case
            // the import carries on to the end, so that the community stops waiting for it
            if !to_remove.is_empty()
                && let Some(channel) = state.data.channels.get_mut(&channel_id)
            {
                // In order of user id, as they were looked at, so that the events are pushed in that order
                to_remove.sort_unstable();
                for user_id in to_remove {
                    let _ = channel
                        .chat
                        .remove_member(Caller::OCBot(OPENCHAT_BOT_USER_ID), user_id, false, now);
                }
            }

            for (old_user_id, latest) in migrated {
                state
                    .data
                    .migrate_user_ids(&[old_user_id], latest.user_id, Some(latest.principal), now);
                if state.data.members.contains(&latest.user_id) {
                    state.data.invited_users.remove(&latest.user_id, now);
                    if state
                        .data
                        .channels
                        .get(&channel_id)
                        .is_some_and(|c| c.chat.members.contains(&latest.user_id))
                    {
                        state.data.members.mark_member_joined_channel(latest.user_id, channel_id);
                    }
                }
                if let Some(added) = added.iter_mut().find(|u| **u == old_user_id) {
                    *added = latest.user_id;
                }
            }

            if !added.is_empty() {
                // Those added to the community join its other public channels a batch at a time
                for other_channel_id in state.data.channels.public_channel_ids() {
                    if other_channel_id != channel_id {
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::JoinMembersToPublicChannel(JoinMembersToPublicChannelJob {
                                channel_id: other_channel_id,
                                members: added.clone(),
                            }),
                            now,
                            now,
                        );
                    }
                }
                job.members_added.extend(added);
            }

            job.after = scanned_to;
            job.attempt = 0;
        } else if job.attempt < 30 {
            job.attempt += 1;
            // Retried after a delay, so that a LocalUserIndex which is briefly unavailable (eg. while
            // it is upgraded) doesn't use up the attempts
            let retry_at = now + IMPORT_MEMBERS_RETRY_INTERVAL * job.attempt as u64;
            state
                .data
                .timer_jobs
                .enqueue_job(TimerJob::ProcessGroupImportChannelMembers(job), retry_at, now);
            return;
        } else {
            // The batch is given up on, and the rest processed
            error!(%group_id, after = ?job.after, "Failed to get the principals of a batch of the group's members");
            job.after = scanned_to;
            job.attempt = 0;
        }

        state
            .data
            .timer_jobs
            .enqueue_job(TimerJob::ProcessGroupImportChannelMembers(job), now, now);
    });
}

// What's done with a batch of the channel's members who aren't members of the community, looked at
// in order of user id. A member the group held by an id they've since been migrated from is added
// under it, as the channel holds them, then moved onto their latest id. If they're already a member
// under it, or are to be added under it, only the channel is moved. If they've been blocked under it,
// they're removed from the channel as when blocked under the old.
struct ChannelMembersBatch {
    // Added together, so that they're written to stable memory together
    to_add: MembersToAdd,
    // Those blocked from the community under their latest ids, who are removed from the channel
    to_remove: Vec<UserId>,
    // Those the group held by ids they've since been migrated from, with their latest ids
    migrated: Vec<(UserId, UserIdAndPrincipal)>,
}

fn plan_batch_of_channel_members(
    users: BTreeMap<UserId, UserIdAndPrincipal>,
    user_types: &BTreeMap<UserId, UserType>,
    members: &CommunityMembers,
) -> ChannelMembersBatch {
    let mut to_add = MembersToAdd::default();
    let mut to_remove = Vec::new();
    let mut migrated = Vec::new();
    for (user_id, latest) in users {
        if latest.user_id != user_id {
            migrated.push((user_id, latest));
            if members.is_blocked(&latest.user_id) {
                to_remove.push(user_id);
                continue;
            }
            if members.contains(&latest.user_id) || to_add.contains(&latest.user_id) {
                continue;
            }
        }
        to_add.push(
            user_id,
            latest.principal,
            user_types.get(&user_id).copied().unwrap_or_default(),
            None,
        );
    }
    ChannelMembersBatch {
        to_add,
        to_remove,
        migrated,
    }
}

// The next batch of the channel's members who aren't members of the community, with their user
// types, and the last of the channel's members looked at. The channel's members looked at who are
// members of the community are marked as members of the channel along the way.
fn next_batch_of_channel_members(
    job: &ProcessGroupImportChannelMembersJob,
    state: &mut RuntimeState,
) -> (BTreeMap<UserId, UserType>, Option<UserId>, CanisterId) {
    let data = &mut state.data;
    let batch_size = if data.test_mode { IMPORT_MEMBERS_BATCH_SIZE_TEST_MODE } else { IMPORT_MEMBERS_BATCH_SIZE };
    let mut batch = BTreeMap::new();
    let mut scanned_to = job.after;
    // Already recorded when the import was finalized, unless that was by an earlier version
    data.channels_importing_members.insert(job.channel_id);

    if let Some(channel) = data.channels.get(&job.channel_id) {
        let bots = channel.chat.members.bots();
        let start = job.after.map_or(Bound::Unbounded, Bound::Excluded);

        for user_id in channel.chat.members.member_ids().range((start, Bound::Unbounded)) {
            scanned_to = Some(*user_id);
            if data.members.contains(user_id) {
                data.members.mark_member_joined_channel(*user_id, job.channel_id);
            } else {
                batch.insert(*user_id, bots.get(user_id).copied().unwrap_or_default());
                if batch.len() >= batch_size {
                    break;
                }
            }
        }
    }

    (batch, scanned_to, data.local_user_index_canister_id)
}

fn complete_processing_channel_members(group_id: ChatId, channel_id: ChannelId, members_added: Vec<UserId>) {
    mutate_state(|state| {
        // Add community members to the channel if it is public
        add_community_members_to_channel_if_public(channel_id, state);

        // By their latest ids, in case the community has been told of any of their migrations since
        // they were added
        let members_added = members_added
            .into_iter()
            .map(|user_id| state.data.migrated_user_ids.latest(user_id))
            .collect();
        state.push_community_event(CommunityEventInternal::GroupImported(Box::new(GroupImportedInternal {
            group_id,
            channel_id,
            members_added,
        })));

        // The channel's state may still hold ids which users had before being migrated to MultiUser
        // canisters (eg. its former members' metrics, or those it blocked, who are now blocked from
        // the community), so the community's state is passed through again, which holds back the job
        // which replaces them in the events until done
        update_user_ids_in_state::on_channel_members_imported(&mut state.data, channel_id);
        update_user_ids_in_state::start_job_if_required(state);

        // Queued as a job, so that it survives an upgrade and the channel can't be deleted until it
        // has run (see `is_importing_into_channel`)
        let now = state.env.now();
        state.data.timer_jobs.enqueue_job(
            TimerJob::MarkGroupImportComplete(MarkGroupImportCompleteJob { group_id, channel_id }),
            now,
            now,
        );
    });
    info!(%group_id, "'process_channel_members' completed");
}

fn add_community_members_to_channel_if_public(channel_id: ChannelId, state: &mut RuntimeState) {
    if let Some(channel) = state.data.channels.get_mut(&channel_id) {
        // If this is a public channel, add all community members to it, other than those who have
        // left it (which, with the import done in batches, they can have done in the meantime)
        if channel.chat.is_public.value && channel.chat.gate_config.value.is_none() {
            JoinMembersToPublicChannelJob {
                channel_id,
                members: state
                    .data
                    .members
                    .iter_member_ids()
                    .filter(|user_id| !state.data.members.member_channel_links_removed_contains(*user_id, channel_id))
                    .collect(),
            }
            .execute_with_state(state);
        }
    }
}

pub(crate) fn mark_import_complete(group_id: ChatId, channel_id: ChannelId) {
    info!(%group_id, "'mark_import_complete' starting");

    mutate_state(|state| {
        let now = state.env.now();
        // Only possible for a channel deleted during its import before that was refused
        let Some(channel) = state.data.channels.get_mut(&channel_id) else {
            error!(%group_id, ?channel_id, "Channel deleted before its import was complete");
            return;
        };
        channel.date_imported = Some(now);
        let channel = state.data.channels.get(&channel_id).unwrap();
        let public_community_activity = state.data.is_public.then(|| extract_activity(now, &state.data));

        state.data.fire_and_forget_handler.send(
            state.data.group_index_canister_id,
            "c2c_mark_group_import_complete_msgpack".to_string(),
            msgpack::serialize_then_unwrap(group_index_canister::c2c_mark_group_import_complete::Args {
                community_name: state.data.name.value.clone(),
                local_user_index_canister_id: state.data.local_user_index_canister_id,
                channel: ChannelLatestMessageIndex {
                    channel_id,
                    latest_message_index: channel.chat.events.main_events_list().latest_message_index(),
                },
                group_id,
                group_name: channel.chat.name.value.clone(),
                members: channel.chat.members.member_ids().iter().copied().collect(),
                other_public_channels: state
                    .data
                    .channels
                    .public_channels()
                    .iter()
                    .filter(|c| c.id != channel_id)
                    .map(|c| ChannelLatestMessageIndex {
                        channel_id: c.id,
                        latest_message_index: c.chat.events.main_events_list().latest_message_index(),
                    })
                    .collect(),
                mark_active_duration: state.data.activity_notification_state.notify(now),
                public_community_activity,
            }),
        )
    });

    info!(%group_id, "'mark_import_complete' completed");
}

// Whether a group is still being imported into the channel, ie. its members are still being added to
// the community, or the GroupIndex is yet to be told that the import is complete. That needs the
// channel, so it can't be deleted until then. Imports finalized by an earlier version are only
// recorded in `channels_importing_members` once their first batch runs, so are known by their jobs
// until then.
pub(crate) fn is_importing_into_channel(channel_id: ChannelId, data: &Data) -> bool {
    data.channels_importing_members.contains(&channel_id)
        || data.timer_jobs.iter().any(|(_, job)| {
            matches!(
                job.deref().borrow().as_ref(),
                Some(
                    TimerJob::ProcessGroupImportChannelMembers(ProcessGroupImportChannelMembersJob { channel_id: c, .. })
                    | TimerJob::MarkGroupImportComplete(MarkGroupImportCompleteJob { channel_id: c, .. })
                ) if *c == channel_id
            )
        })
}

// Whether retrying the import could ever succeed. A batch which is too large for the group to
// reply with fails as a contract violation - the page size is fixed, so it would fail identically
// every time and the import has to be abandoned rather than retried forever.
//
// Unfortunately this can only be recognised from the reject message: a contract violation reaches
// us as a plain `CanisterError`, and the IC does not expose its fine grained error codes to
// canisters, so the reject code alone cannot distinguish it from a transient trap. The reject code
// is still checked so that unrelated failures can't match on the text alone.
fn is_unrecoverable(error: &C2CError) -> bool {
    matches!(error.reject_code(), RejectCode::CanisterError) && error.message().contains("violated contract")
}

fn trigger_upgrade_to_finalize_import(group_id: ChatId) {
    mutate_state(|state| {
        if state.data.groups_being_imported.contains(&group_id) {
            state.data.fire_and_forget_handler.send(
                state.data.local_user_index_canister_id,
                "c2c_trigger_upgrade_msgpack".to_string(),
                msgpack::serialize_then_unwrap(Empty {}),
            );
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_principal::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn a_batch_of_channel_members_is_planned_as_when_added_one_at_a_time() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let user = |i: u8| UserId::from(Principal::from_slice(&[i]));
        let latest = |i: u8| UserIdAndPrincipal::new(user(i), Principal::from_slice(&[100, i]));
        // User 2 is a member and user 3 is blocked
        let mut members = CommunityMembers::new(Principal::from_slice(&[100, 1]), user(1), UserType::User, Vec::new(), 0);
        members.add(user(2), latest(2).principal, UserType::User, None, 0);
        members.block(user(3), 0);

        // The group holds users 5, 6, 8 and 9 by ids they've since been migrated from. User 5's latest
        // id is blocked, user 6's is a member, user 9's is added earlier in the batch, and user 8's
        // later. User 3 is blocked under the id the group holds.
        let users: BTreeMap<_, _> = [(3, 3), (4, 4), (5, 3), (6, 2), (8, 11), (9, 4), (11, 11)]
            .into_iter()
            .map(|(id, latest_id)| (user(id), latest(latest_id)))
            .collect();
        let user_types = BTreeMap::from([(user(4), UserType::BotV2)]);

        let batch = plan_batch_of_channel_members(users, &user_types, &members);

        assert_eq!(batch.to_add.user_ids(), [3, 4, 8, 11].map(user).to_vec());
        assert_eq!(batch.to_remove, vec![user(5)]);
        let migrated: Vec<_> = batch.migrated.iter().map(|(u, l)| (*u, l.user_id)).collect();
        assert_eq!(
            migrated,
            [(5, 3), (6, 2), (8, 11), (9, 4)].map(|(u, l)| (user(u), user(l))).to_vec()
        );

        // User 3 is then found to be blocked, so is removed from the channel too
        let results: Vec<_> = members
            .add_many(batch.to_add, 10)
            .into_iter()
            .map(|(user_id, result)| (user_id, matches!(result, AddResult::Success(_))))
            .collect();
        assert_eq!(
            results,
            vec![(user(3), false), (user(4), true), (user(8), true), (user(11), true)]
        );
        assert!(members.bots().contains_key(&user(4)));
    }
}
