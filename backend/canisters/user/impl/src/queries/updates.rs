use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState, WASM_VERSION};
use group_index_canister::c2c_filter_groups;
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::query;
use std::collections::{HashMap, HashSet};
use types::{Alert, AlertDetails, AlertId, CanisterId, ChatId, ChatSummary, ChatSummaryUpdates, DeletedGroupInfo, DirectChatSummary, DirectChatSummaryUpdates, GroupChatSummary, GroupChatSummaryInternal, GroupChatSummaryUpdates, GroupChatSummaryUpdatesInternal, GroupDeleted, Milliseconds, OptionUpdate, TimestampMillis};
use user_canister::{initial_state, updates, updates::UpdatesSince};
use utils::range_set::convert_to_message_index_ranges;

#[query(guard = "caller_is_owner")]
async fn initial_state(_args: initial_state::Args) -> initial_state::Response {
    let prepare_result = read_state(|state| prepare(None, state));

    let mut group_chats_added = prepare_result.group_chats_added;

    let mut summaries = Vec::new();
    let mut deleted_groups = Vec::new();
    let mut upgrades_in_progress = Vec::new();
    if !group_chats_added.is_empty() {
        let filter_groups_args = c2c_filter_groups::Args {
            chat_ids: group_chats_added.clone(),
            active_in_last: None,
        };
        let filter_groups_result = match group_index_canister_c2c_client::c2c_filter_groups(
            prepare_result.group_index_canister_id,
            &filter_groups_args,
        )
        .await
        {
            Ok(group_index_canister::c2c_filter_groups::Response::Success(result)) => result,
            Err(error) => {
                return initial_state::Response::InternalError(format!("Failed to call 'c2c_filter_groups': {error:?}"))
            }
        };

        group_chats_added.retain(|id| {
            !has_group_been_deleted(&filter_groups_result.deleted_groups, id)
                && !filter_groups_result.upgrades_in_progress.contains(id)
        });

        summaries = get_group_chat_summaries(group_chats_added).await;
        deleted_groups = filter_groups_result.deleted_groups;
        upgrades_in_progress = filter_groups_result.upgrades_in_progress;
    }

    let result = read_state(|state| finalize(None, summaries, Vec::new(), deleted_groups, upgrades_in_progress, state));

    initial_state::Response::Success(initial_state::SuccessResult {
        timestamp: result.timestamp,
        chats: result.chats_added,
        transactions: result.transactions,
        blocked_users: result.blocked_users,
        cycles_balance: result.cycles_balance.unwrap_or(0),
        upgrades_in_progress: result.upgrades_in_progress,
        user_canister_wasm_version: WASM_VERSION.with(|v| **v.borrow()),
    })
}

#[query(guard = "caller_is_owner")]
async fn updates(args: updates::Args) -> updates::Response {
    let prepare_result = read_state(|state| prepare(Some(&args.updates_since), state));

    let mut group_chats_added = prepare_result.group_chats_added;
    let mut group_chats_to_check_for_updates = prepare_result.group_chats_to_check_for_updates;
    let mut all_groups: Vec<_> = group_chats_added.clone();
    all_groups.extend(group_chats_to_check_for_updates.iter().map(|(id, _)| *id));

    let mut summaries = Vec::new();
    let mut summary_updates = Vec::new();
    let mut deleted_groups = Vec::new();
    let mut upgrades_in_progress = Vec::new();
    if !all_groups.is_empty() {
        let filter_groups_args = c2c_filter_groups::Args {
            chat_ids: all_groups,
            active_in_last: Some(prepare_result.duration_since_last_sync),
        };
        let filter_groups_result = match group_index_canister_c2c_client::c2c_filter_groups(
            prepare_result.group_index_canister_id,
            &filter_groups_args,
        )
        .await
        {
            Ok(group_index_canister::c2c_filter_groups::Response::Success(result)) => result,
            Err(error) => return updates::Response::InternalError(format!("Failed to call 'c2c_filter_groups': {error:?}")),
        };

        deleted_groups = filter_groups_result.deleted_groups;
        upgrades_in_progress = filter_groups_result.upgrades_in_progress;
        let active_groups: HashSet<_> = filter_groups_result.active_groups.into_iter().collect();

        group_chats_added.retain(|id| !has_group_been_deleted(&deleted_groups, id) && !upgrades_in_progress.contains(id));
        group_chats_to_check_for_updates.retain(|(id, _)| active_groups.contains(id) && !upgrades_in_progress.contains(id));

        let summaries_future = get_group_chat_summaries(group_chats_added);
        let summary_updates_future = get_group_chat_summary_updates(group_chats_to_check_for_updates);

        let (s, su) = futures::future::join(summaries_future, summary_updates_future).await;
        summaries = s;
        summary_updates = su;
    }

    let result = read_state(|state| {
        finalize(
            Some(&args.updates_since),
            summaries,
            summary_updates,
            deleted_groups,
            upgrades_in_progress,
            state,
        )
    });

    updates::Response::Success(result)
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    duration_since_last_sync: Milliseconds,
    group_chats_to_check_for_updates: Vec<(ChatId, TimestampMillis)>,
    group_chats_added: Vec<ChatId>,
}

fn prepare(updates_since_option: Option<&UpdatesSince>, runtime_state: &RuntimeState) -> PrepareResult {
    let now = runtime_state.env.now();
    if let Some(updates_since) = updates_since_option {
        let duration_since_last_sync = now.saturating_sub(updates_since.timestamp);

        let mut group_chats_to_check_for_updates = Vec::new();
        let mut group_chats_added = Vec::new();
        let group_chat_args_map: HashMap<_, _> = updates_since
            .group_chats
            .iter()
            .map(|g| (g.chat_id, g.updates_since))
            .collect();

        // TODO handle groups that the user has been removed from
        for chat_id in runtime_state.data.group_chats.iter().map(|g| g.chat_id) {
            if let Some(updates_since) = group_chat_args_map.get(&chat_id) {
                group_chats_to_check_for_updates.push((chat_id, *updates_since));
            } else {
                group_chats_added.push(chat_id);
            }
        }

        PrepareResult {
            group_index_canister_id: runtime_state.data.group_index_canister_id,
            duration_since_last_sync,
            group_chats_to_check_for_updates,
            group_chats_added,
        }
    } else {
        let new_group_chats = runtime_state.data.group_chats.iter().map(|g| g.chat_id).collect();

        PrepareResult {
            group_index_canister_id: runtime_state.data.group_index_canister_id,
            duration_since_last_sync: now,
            group_chats_to_check_for_updates: Vec::new(),
            group_chats_added: new_group_chats,
        }
    }
}

async fn get_group_chat_summaries(chat_ids: Vec<ChatId>) -> Vec<GroupChatSummaryInternal> {
    if chat_ids.is_empty() {
        return Vec::new();
    }

    let args = group_canister::c2c_summary::Args {};
    let futures: Vec<_> = chat_ids
        .into_iter()
        .map(|chat_id| group_canister_c2c_client::c2c_summary(chat_id.into(), &args))
        .collect();

    let responses = futures::future::join_all(futures).await;

    let mut summaries = Vec::new();
    for response in responses.into_iter().flatten() {
        if let group_canister::c2c_summary::Response::Success(result) = response {
            summaries.push(result.summary);
        }
    }

    summaries
}

async fn get_group_chat_summary_updates(group_chats: Vec<(ChatId, TimestampMillis)>) -> Vec<GroupChatSummaryUpdatesInternal> {
    if group_chats.is_empty() {
        return Vec::new();
    }

    async fn get_summary_updates(
        canister_id: CanisterId,
        args: group_canister::c2c_summary_updates::Args,
    ) -> CallResult<group_canister::c2c_summary_updates::Response> {
        group_canister_c2c_client::c2c_summary_updates(canister_id, &args).await
    }

    let futures: Vec<_> = group_chats
        .into_iter()
        .map(|(g, t)| {
            let args = group_canister::c2c_summary_updates::Args { updates_since: t };
            get_summary_updates(g.into(), args)
        })
        .collect();

    let responses = futures::future::join_all(futures).await;

    let mut summary_updates = Vec::new();
    for response in responses.into_iter().flatten() {
        if let group_canister::c2c_summary_updates::Response::Success(result) = response {
            summary_updates.push(result.updates);
        }
    }

    summary_updates
}

fn finalize(
    updates_since_option: Option<&UpdatesSince>,
    group_chats_added: Vec<GroupChatSummaryInternal>,
    group_chats_updated: Vec<GroupChatSummaryUpdatesInternal>,
    groups_deleted: Vec<DeletedGroupInfo>,
    upgrades_in_progress: Vec<ChatId>,
    runtime_state: &RuntimeState,
) -> updates::SuccessResult {
    let now = runtime_state.env.now();
    let updates_since = updates_since_option
        .as_ref()
        .map_or(TimestampMillis::default(), |s| s.timestamp);

    // The list of chats_removed currently consists of deleted groups and groups the user
    // has been removed from since the given timestamp
    let chats_removed: Vec<ChatId> = if let Some(since) = updates_since_option {
        let mut chats_removed: HashSet<ChatId> = groups_deleted.iter().map(|gd| gd.id).collect();
        let groups_removed = runtime_state.data.group_chats.removed_since(since.timestamp);
        if !groups_removed.is_empty() {
            chats_removed.extend(groups_removed.iter());
        }
        chats_removed.into_iter().collect()
    } else {
        groups_deleted.iter().map(|gd| gd.id).collect()
    };

    let mut group_chats_added: HashMap<ChatId, GroupChatSummary> =
        group_chats_added.into_iter().map(|s| (s.chat_id, s.into())).collect();

    let mut group_chats_updated: HashMap<ChatId, GroupChatSummaryUpdates> =
        group_chats_updated.into_iter().map(|s| (s.chat_id, s.into())).collect();

    for group_chat in runtime_state.data.group_chats.get_all(Some(updates_since)) {
        if has_group_been_deleted(&groups_deleted, &group_chat.chat_id) {
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
            }));
        } else {
            let latest_message = direct_chat.events.latest_message_if_updated(updates_since, Some(my_user_id));
            let latest_event = direct_chat.events.last();
            let latest_event_index = if latest_event.timestamp > updates_since { Some(latest_event.index) } else { None };

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
            }));
        }
    }

    let transactions = runtime_state.data.transactions.most_recent(updates_since, 20);
    let blocked_users = runtime_state.data.blocked_users.iter().copied().collect();
    let cycles_balance = if runtime_state.data.user_cycles_balance.last_updated() > updates_since {
        Some(runtime_state.data.user_cycles_balance.value())
    } else {
        None
    };

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
    for group_deleted in groups_deleted {
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
        transactions,
        blocked_users,
        cycles_balance,
        avatar_id,
        alerts,
        upgrades_in_progress,
        user_canister_wasm_version: WASM_VERSION.with(|v| v.borrow().if_set_after(updates_since).copied()),
    }
}

fn has_group_been_deleted(groups: &[DeletedGroupInfo], group_id: &ChatId) -> bool {
    groups.iter().any(|g| g.id == *group_id)
}
