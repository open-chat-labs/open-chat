use crate::group_summaries::{build_summaries_args, build_updates_args};
use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState, WASM_VERSION};
use ic_cdk_macros::query;
use std::collections::{HashMap, HashSet};
use types::{
    Alert, AlertDetails, AlertId, ChatId, ChatSummary, ChatSummaryUpdates, DeletedGroupInfo, DirectChatSummary,
    DirectChatSummaryUpdates, GroupChatSummary, GroupChatSummaryInternal, GroupChatSummaryUpdates,
    GroupChatSummaryUpdatesInternal, GroupDeleted, OptionUpdate, TimestampMillis,
};
use user_canister::{initial_state, updates};
use utils::range_set::convert_to_message_index_ranges;

#[query(guard = "caller_is_owner")]
async fn initial_state(_args: initial_state::Args) -> initial_state::Response {
    let group_summaries_args = read_state(|state| build_summaries_args(state.env.now(), &state.data));

    match crate::group_summaries::summaries(group_summaries_args).await {
        Ok(group_summaries) => {
            let result = read_state(|state| {
                finalize(
                    0,
                    group_summaries.groups,
                    Vec::new(),
                    Vec::new(),
                    group_summaries.upgrades_in_progress,
                    state,
                )
            });

            initial_state::Response::Success(initial_state::SuccessResult {
                timestamp: result.timestamp,
                chats: result.chats_added,
                // transactions: result.transactions,
                blocked_users: result.blocked_users,
                cycles_balance: 0,
                upgrades_in_progress: result.upgrades_in_progress,
                user_canister_wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            })
        }
        Err(error) => initial_state::Response::InternalError(error),
    }
}

#[query(guard = "caller_is_owner")]
async fn updates(args: updates::Args) -> updates::Response {
    let updates_since_timestamp = args.updates_since.timestamp;
    let group_updates_args = read_state(|state| build_updates_args(args.updates_since, state.env.now(), &state.data));

    match crate::group_summaries::updates(group_updates_args).await {
        Ok(group_updates) => {
            let result = read_state(|state| {
                finalize(
                    updates_since_timestamp,
                    group_updates.added,
                    group_updates.updated,
                    group_updates.deleted,
                    group_updates.upgrades_in_progress,
                    state,
                )
            });
            updates::Response::Success(result)
        }
        Err(error) => updates::Response::InternalError(error),
    }
}

fn finalize(
    updates_since: TimestampMillis,
    group_chats_added: Vec<GroupChatSummaryInternal>,
    group_chats_updated: Vec<GroupChatSummaryUpdatesInternal>,
    group_chats_deleted: Vec<DeletedGroupInfo>,
    group_chat_upgrades_in_progress: Vec<ChatId>,
    runtime_state: &RuntimeState,
) -> updates::SuccessResult {
    let now = runtime_state.env.now();

    // The list of chats_removed currently consists of deleted groups and groups the user
    // has been removed from since the given timestamp
    let chats_removed: Vec<ChatId> = if updates_since > 0 {
        let mut chats_removed: HashSet<ChatId> = group_chats_deleted.iter().map(|gd| gd.id).collect();
        let groups_removed = runtime_state.data.group_chats.removed_since(updates_since);
        if !groups_removed.is_empty() {
            chats_removed.extend(groups_removed.iter());
        }
        chats_removed.into_iter().collect()
    } else {
        group_chats_deleted.iter().map(|gd| gd.id).collect()
    };

    let mut group_chats_added: HashMap<ChatId, GroupChatSummary> =
        group_chats_added.into_iter().map(|s| (s.chat_id, s.into())).collect();

    let mut group_chats_updated: HashMap<ChatId, GroupChatSummaryUpdates> =
        group_chats_updated.into_iter().map(|s| (s.chat_id, s.into())).collect();

    for group_chat in runtime_state.data.group_chats.get_all(Some(updates_since)) {
        if has_group_been_deleted(&group_chats_deleted, &group_chat.chat_id) {
            continue;
        }

        if let Some(summary) = group_chats_added.get_mut(&group_chat.chat_id) {
            summary.notifications_muted = group_chat.notifications_muted.value;
            summary.read_by_me = convert_to_message_index_ranges(group_chat.read_by_me.value.clone());
        } else {
            group_chats_updated
                .entry(group_chat.chat_id)
                .and_modify(|su| {
                    su.notifications_muted = if group_chat.notifications_muted.timestamp > updates_since {
                        Some(group_chat.notifications_muted.value)
                    } else {
                        None
                    };
                    su.read_by_me = if group_chat.read_by_me.timestamp > updates_since {
                        Some(convert_to_message_index_ranges(group_chat.read_by_me.value.clone()))
                    } else {
                        None
                    };
                })
                .or_insert_with(|| group_chat.into());
        }
    }

    let mut chats_added: Vec<_> = group_chats_added.into_values().map(ChatSummary::Group).collect();
    let mut chats_updated: Vec<_> = group_chats_updated.into_values().map(ChatSummaryUpdates::Group).collect();

    let my_user_id = runtime_state.env.canister_id().into();

    for direct_chat in runtime_state.data.direct_chats.get_all(Some(updates_since)) {
        if direct_chat.date_created > updates_since {
            chats_added.push(ChatSummary::Direct(DirectChatSummary {
                them: direct_chat.them,
                latest_message: direct_chat.events.latest_message(Some(my_user_id)).unwrap(),
                latest_event_index: direct_chat.events.last().index,
                date_created: direct_chat.date_created,
                read_by_me: convert_to_message_index_ranges(direct_chat.read_by_me.value.clone()),
                read_by_them: convert_to_message_index_ranges(direct_chat.read_by_them.value.clone()),
                notifications_muted: direct_chat.notifications_muted.value,
                metrics: direct_chat.events.metrics().clone(),
                my_metrics: direct_chat
                    .events
                    .user_metrics(&my_user_id, None)
                    .cloned()
                    .unwrap_or_default(),
            }));
        } else {
            let latest_message = direct_chat.events.latest_message_if_updated(updates_since, Some(my_user_id));
            let latest_event = direct_chat.events.last();
            let has_new_events = latest_event.timestamp > updates_since;
            let latest_event_index = if has_new_events { Some(latest_event.index) } else { None };
            let metrics = if has_new_events { Some(direct_chat.events.metrics().clone()) } else { None };

            let read_by_me = if direct_chat.read_by_me.timestamp > updates_since {
                Some(convert_to_message_index_ranges(direct_chat.read_by_me.value.clone()))
            } else {
                None
            };

            let read_by_them = if direct_chat.read_by_them.timestamp > updates_since {
                Some(convert_to_message_index_ranges(direct_chat.read_by_them.value.clone()))
            } else {
                None
            };

            let notifications_muted = direct_chat.notifications_muted.if_set_after(updates_since).copied();
            let affected_events = direct_chat.events.affected_event_indexes_since(updates_since, 100);

            chats_updated.push(ChatSummaryUpdates::Direct(DirectChatSummaryUpdates {
                chat_id: direct_chat.them.into(),
                latest_message,
                latest_event_index,
                read_by_me,
                read_by_them,
                notifications_muted,
                affected_events,
                metrics,
                my_metrics: direct_chat.events.user_metrics(&my_user_id, Some(updates_since)).cloned(),
            }));
        }
    }

    // let transactions = runtime_state.data.transactions.most_recent(updates_since, 20);
    let blocked_users = runtime_state.data.blocked_users.iter().copied().collect();

    let avatar_id = runtime_state
        .data
        .avatar
        .if_set_after(updates_since)
        .map_or(OptionUpdate::NoChange, |update| {
            OptionUpdate::from_update(update.as_ref().map(|a| a.id))
        });

    // Combine the internal alerts with alerts based on deleted groups
    // and sort so the most recent alerts are at the top
    let mut alerts = runtime_state.data.alerts.get_all(Some(updates_since), now);
    for group_deleted in group_chats_deleted {
        let alert = Alert {
            id: AlertId::GroupDeleted(group_deleted.id).to_string(),
            elapsed: now - group_deleted.timestamp,
            details: AlertDetails::GroupDeleted(GroupDeleted {
                chat_id: group_deleted.id,
                deleted_by: group_deleted.deleted_by,
            }),
        };
        alerts.push(alert);
    }
    alerts.sort_by_key(|a| a.elapsed);

    updates::SuccessResult {
        timestamp: now,
        chats_added,
        chats_updated,
        chats_removed,
        // transactions,
        blocked_users,
        cycles_balance: None,
        avatar_id,
        alerts,
        upgrades_in_progress: group_chat_upgrades_in_progress,
        user_canister_wasm_version: WASM_VERSION.with(|v| v.borrow().if_set_after(updates_since).copied()),
    }
}

fn has_group_been_deleted(groups: &[DeletedGroupInfo], group_id: &ChatId) -> bool {
    groups.iter().any(|g| g.id == *group_id)
}
