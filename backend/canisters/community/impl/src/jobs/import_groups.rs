use crate::activity_notifications::extract_activity;
use crate::model::channels::Channel;
use crate::model::events::{CommunityEventInternal, GroupImportedInternal};
use crate::model::groups_being_imported::{GroupToImport, GroupToImportAction};
use crate::model::members::AddResult;
use crate::timer_job_types::{FinalizeGroupImportJob, ProcessGroupImportChannelMembersJob, TimerJob};
use crate::updates::c2c_join_channel::{add_members_to_public_channel_unchecked, join_channel_unchecked};
use crate::{mutate_state, read_state, RuntimeState};
use chat_events::ChatEvents;
use group_canister::c2c_export_group::{Args, Response};
use group_chat_core::GroupChatCore;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{info, trace};
use types::{ChannelId, ChannelLatestMessageIndex, Chat, ChatId, CommunityUsersBlocked, Empty, UserId, UserType};
use utils::consts::OPENCHAT_BOT_USER_ID;

const PAGE_SIZE: u32 = 19 * 102 * 1024; // Roughly 1.9MB (1.9 * 1024 * 1024)

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.groups_being_imported.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'import_groups' job running");
    TIMER_ID.set(None);

    let batch = mutate_state(next_batch);
    if !batch.is_empty() {
        ic_cdk::spawn(import_groups(batch));
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
                            ic_cdk_timers::set_timer(Duration::from_secs(10), move || {
                                trigger_upgrade_to_finalize_import(group_id)
                            });

                            info!(%group_id, "Group data imported");
                        }
                    });
                }
                Err(error) => {
                    mutate_state(|state| {
                        if error.1.contains("violated contract") {
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
                            state
                                .data
                                .groups_being_imported
                                .mark_events_batch_complete(&group_id, up_to.clone());
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
    }
}

pub(crate) fn finalize_group_import(group_id: ChatId) {
    info!(%group_id, "'finalize_group_import' starting");
    let initial_instruction_count = ic_cdk::api::instruction_counter();

    mutate_state(|state| {
        if let Some(group) = state.data.groups_being_imported.take(&group_id) {
            let now = state.env.now();
            let channel_id = group.channel_id();
            let mut chat: GroupChatCore = msgpack::deserialize_then_unwrap(group.bytes());
            chat.events
                .set_chat(Chat::Channel(state.env.canister_id().into(), channel_id));

            let blocked: Vec<_> = chat.members.blocked.iter().copied().collect();
            if !blocked.is_empty() {
                let mut blocked_from_community = Vec::new();

                // We don't (currently) support blocking/unblocking members at the channel level, so we unblock users
                // from the channel and instead block them from the community (unless they were already in the
                // community).
                for user_id in blocked {
                    chat.members.unblock(user_id, now);

                    // If the user is not already a member of the community, block them from the community
                    if state.data.members.get_by_user_id(&user_id).is_none() && state.data.members.block(user_id) {
                        blocked_from_community.push(user_id);
                    }
                }
                if !blocked_from_community.is_empty() {
                    state.data.events.push_event(
                        CommunityEventInternal::UsersBlocked(Box::new(CommunityUsersBlocked {
                            user_ids: blocked_from_community,
                            blocked_by: OPENCHAT_BOT_USER_ID,
                            referred_by: HashMap::new(),
                        })),
                        now,
                    );
                }
            }

            state.data.channels.add(Channel {
                id: channel_id,
                chat,
                date_imported: None, // This is only set once everything is complete
            });
            state.data.stable_memory_event_migration_complete = false;

            state.data.timer_jobs.enqueue_job(
                TimerJob::ProcessGroupImportChannelMembers(ProcessGroupImportChannelMembersJob {
                    group_id,
                    channel_id,
                    attempt: 0,
                }),
                now,
                now,
            );
        }
    });

    let instruction_count = ic_cdk::api::instruction_counter() - initial_instruction_count;
    info!(%group_id, instruction_count, "'finalize_group_import' completed");
}

// 1. For channel members already in the community, add the new channel to their set of channels.
// 2. If the channel is public, for community members not in the channel, add them to the channel.
// 3. For channel members who are not yet community members, lookup their principals, then join them
// to the community, then add them to the public channels, then add the new channel to their set of
// channels.
pub(crate) async fn process_channel_members(group_id: ChatId, channel_id: ChannelId, attempt: u32) {
    info!(%group_id, attempt, "'process_channel_members' starting");

    let (members_to_add_to_community, local_user_index_canister_id) = mutate_state(|state| {
        let channel = state.data.channels.get(&channel_id).unwrap();
        let mut to_add: HashMap<UserId, UserType> = HashMap::new();
        for (user_id, user_type) in channel.chat.members.iter().map(|m| (m.user_id, m.user_type)) {
            if let Some(member) = state.data.members.get_by_user_id_mut(&user_id) {
                member.channels.insert(channel_id);
            } else {
                to_add.insert(user_id, user_type);
            }
        }

        (to_add, state.data.local_user_index_canister_id)
    });

    let mut members_added = Vec::new();

    if !members_to_add_to_community.is_empty() {
        let c2c_args = local_user_index_canister::c2c_user_principals::Args {
            user_ids: members_to_add_to_community.keys().copied().collect(),
        };
        if let Ok(local_user_index_canister::c2c_user_principals::Response::Success(users)) =
            local_user_index_canister_c2c_client::c2c_user_principals(local_user_index_canister_id, &c2c_args).await
        {
            mutate_state(|state| {
                let now = state.env.now();

                // Add existing community members to the channel if it is public
                add_community_members_to_channel_if_public(channel_id, state);

                let public_channel_ids = state.data.channels.public_channel_ids();
                for (user_id, principal) in users {
                    match state.data.members.add(
                        user_id,
                        principal,
                        members_to_add_to_community.get(&user_id).copied().unwrap_or_default(),
                        None,
                        now,
                    ) {
                        AddResult::Success(_) => {
                            state.data.invited_users.remove(&user_id, now);

                            let member = state.data.members.get_by_user_id_mut(&user_id).unwrap();
                            for channel_id in public_channel_ids.iter() {
                                if let Some(channel) = state.data.channels.get_mut(channel_id) {
                                    if channel.chat.gate_config.is_none() {
                                        join_channel_unchecked(channel, member, state.data.is_public, true, now);
                                    }
                                }
                            }
                            member.channels.insert(channel_id);
                            members_added.push(user_id);
                        }
                        AddResult::AlreadyInCommunity => {}
                        AddResult::Blocked => {
                            let channel = state.data.channels.get_mut(&channel_id).unwrap();
                            channel.chat.remove_member(OPENCHAT_BOT_USER_ID, user_id, false, now);
                        }
                    }
                }
            });
        } else if attempt < 30 {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.timer_jobs.enqueue_job(
                    TimerJob::ProcessGroupImportChannelMembers(ProcessGroupImportChannelMembersJob {
                        group_id,
                        channel_id,
                        attempt: attempt + 1,
                    }),
                    now,
                    now,
                );
            });
            return;
        }
    } else {
        // Add community members to the channel if it is public
        mutate_state(|state| add_community_members_to_channel_if_public(channel_id, state));
    }

    mutate_state(|state| {
        state.data.events.push_event(
            CommunityEventInternal::GroupImported(Box::new(GroupImportedInternal {
                group_id,
                channel_id,
                members_added,
            })),
            state.env.now(),
        );
    });

    ic_cdk_timers::set_timer(Duration::ZERO, move || mark_import_complete(group_id, channel_id));
    info!(%group_id, attempt, "'process_channel_members' completed");
}

fn add_community_members_to_channel_if_public(channel_id: ChannelId, state: &mut RuntimeState) {
    if let Some(channel) = state.data.channels.get_mut(&channel_id) {
        // If this is a public channel, add all community members to it
        if channel.chat.is_public.value && channel.chat.gate_config.value.is_none() {
            let now = state.env.now();
            add_members_to_public_channel_unchecked(channel, state.data.is_public, state.data.members.iter_mut(), now);
        }
    }
}

pub(crate) fn mark_import_complete(group_id: ChatId, channel_id: ChannelId) {
    info!(%group_id, "'mark_import_complete' starting");

    mutate_state(|state| {
        let now = state.env.now();
        state.data.channels.get_mut(&channel_id).unwrap().date_imported = Some(now);
        let channel = state.data.channels.get(&channel_id).unwrap();
        let public_community_activity = state.data.is_public.then(|| extract_activity(now, &state.data));

        state.data.fire_and_forget_handler.send(
            state.data.group_index_canister_id,
            "c2c_mark_group_import_complete_msgpack".to_string(),
            msgpack::serialize_then_unwrap(group_index_canister::c2c_mark_group_import_complete::Args {
                community_name: state.data.name.clone(),
                local_user_index_canister_id: state.data.local_user_index_canister_id,
                channel: ChannelLatestMessageIndex {
                    channel_id,
                    latest_message_index: channel.chat.events.main_events_list().latest_message_index(),
                },
                group_id,
                group_name: channel.chat.name.value.clone(),
                members: channel.chat.members.iter().map(|m| m.user_id).collect(),
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

fn trigger_upgrade_to_finalize_import(group_id: ChatId) {
    mutate_state(|state| {
        if state.data.groups_being_imported.contains(&group_id) {
            state.data.fire_and_forget_handler.send(
                state.data.local_group_index_canister_id,
                "c2c_trigger_upgrade_msgpack".to_string(),
                msgpack::serialize_then_unwrap(Empty {}),
            );
        }
    });
}
