use crate::activity_notifications::extract_activity;
use crate::model::channels::Channel;
use crate::model::events::CommunityEvent;
use crate::model::groups_being_imported::NextBatchResult;
use crate::model::members::AddResult;
use crate::updates::c2c_join_channel::join_channel_unchecked;
use crate::{mutate_state, RuntimeState};
use group_canister::c2c_export_group::{Args, Response};
use group_chat_core::GroupChatCore;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{ChannelId, ChatId, MemberJoined};
use utils::consts::OPENCHAT_BOT_USER_ID;

const PAGE_SIZE: u32 = 19 * 102 * 1024; // Roughly 1.9MB (1.9 * 1024 * 1024)

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.groups_being_imported.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'import_groups' job started");
        true
    } else {
        false
    }
}

fn run() {
    match mutate_state(next_batch) {
        NextBatchResult::Success(groups) => ic_cdk::spawn(import_groups(groups)),
        NextBatchResult::Continue => {}
        NextBatchResult::Exit => {
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("'import_groups' job stopped");
            }
        }
    }
}

fn next_batch(state: &mut RuntimeState) -> NextBatchResult {
    let now = state.env.now();
    state.data.groups_being_imported.next_batch(now)
}

async fn import_groups(groups: Vec<(ChatId, u64)>) {
    futures::future::join_all(groups.into_iter().map(|(g, i)| import_group(g, i))).await;
}

async fn import_group(group_id: ChatId, from: u64) {
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
                    ic_cdk_timers::set_timer(Duration::ZERO, move || deserialize_group(group_id));
                }
            });
        }
        Err(error) => {
            mutate_state(|state| {
                state
                    .data
                    .groups_being_imported
                    .mark_batch_failed(&group_id, format!("{error:?}"));

                start_job_if_required(state);
            });
        }
    }
}

fn deserialize_group(group_id: ChatId) {
    mutate_state(|state| {
        if let Some(group) = state.data.groups_being_imported.take(&group_id) {
            let channel_id = group.channel_id();
            let chat: GroupChatCore = msgpack::deserialize_then_unwrap(group.bytes());

            state.data.channels.add(Channel {
                id: channel_id,
                chat,
                is_default: group.is_default(),
                date_imported: None, // This is only set once everything is complete
            });

            ic_cdk_timers::set_timer(Duration::ZERO, move || {
                ic_cdk::spawn(process_channel_members(group_id, channel_id, 0))
            });
        }
    });
}

// For each user already in the community, add the new channel to their set of channels.
// For users who are not members, lookup their principals, then join them to the community, then add
// them to the default channels, then add the new channel to their set of channels.
async fn process_channel_members(group_id: ChatId, channel_id: ChannelId, attempt: u32) {
    let (members_to_add, local_user_index_canister_id, is_public) = mutate_state(|state| {
        let channel = state.data.channels.get(&channel_id).unwrap();
        let mut to_add = Vec::new();
        for user_id in channel.chat.members.iter().map(|m| m.user_id) {
            if let Some(member) = state.data.members.get_by_user_id_mut(&user_id) {
                member.channels.insert(channel_id);
            } else {
                to_add.push(user_id);
            }
        }

        (to_add, state.data.local_user_index_canister_id, state.data.is_public)
    });

    if !members_to_add.is_empty() {
        let c2c_args = local_user_index_canister::c2c_user_principals::Args {
            user_ids: members_to_add,
        };
        if let Ok(local_user_index_canister::c2c_user_principals::Response::Success(users)) =
            local_user_index_canister_c2c_client::c2c_user_principals(local_user_index_canister_id, &c2c_args).await
        {
            mutate_state(|state| {
                let now = state.env.now();
                let notifications_muted = is_public;
                let default_channel_ids = state.data.channels.default_channel_ids();

                for (user_id, principal) in users {
                    match state.data.members.add(user_id, principal, now) {
                        AddResult::Success(_) => {
                            state.data.invited_users.remove(&user_id, now);
                            state.data.events.push_event(
                                CommunityEvent::MemberJoined(Box::new(MemberJoined {
                                    user_id,
                                    invited_by: None,
                                })),
                                now,
                            );
                            let member = state.data.members.get_by_user_id_mut(&user_id).unwrap();
                            for default_channel_id in default_channel_ids.iter() {
                                if let Some(channel) = state.data.channels.get_mut(default_channel_id) {
                                    join_channel_unchecked(channel, member, notifications_muted, now);
                                }
                            }
                            member.channels.insert(channel_id);
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
            ic_cdk_timers::set_timer(Duration::from_secs(30), move || {
                ic_cdk::spawn(process_channel_members(group_id, channel_id, attempt + 1))
            });
            return;
        }
    }

    ic_cdk_timers::set_timer(Duration::ZERO, move || mark_import_complete(group_id, channel_id));
}

fn mark_import_complete(group_id: ChatId, channel_id: ChannelId) {
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
                channel_id,
                group_id,
                group_name: channel.chat.name.clone(),
                members: channel.chat.members.iter().map(|m| m.user_id).collect(),
                mark_active_duration: state.data.activity_notification_state.notify(now),
                public_community_activity,
            }),
        )
    });
}
