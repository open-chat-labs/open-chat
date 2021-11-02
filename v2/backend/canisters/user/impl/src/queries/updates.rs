use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::summary::Summary;
use group_canister::summary_updates::SummaryUpdates;
use group_index_canister::{c2c_active_and_deleted_groups, c2c_deleted_groups};
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::query;
use std::collections::hash_map::Entry::Occupied;
use std::collections::{HashMap, HashSet};
use tracing::error;
use types::{
    CanisterId, ChatId, ChatSummary, ChatSummaryUpdates, DeletedGroupInfo, DirectChatSummary, DirectChatSummaryUpdates,
    GroupChatSummary, GroupChatSummaryUpdates, Milliseconds, TimestampMillis,
};
use user_canister::{initial_state, updates, updates::UpdatesSince};
use utils::range_set::convert_to_message_index_ranges;

#[query]
async fn initial_state(_args: initial_state::Args) -> initial_state::Response {
    let prepare_result = RUNTIME_STATE.with(|state| prepare(None, state.borrow().as_ref().unwrap()));

    let summaries = get_group_chat_summaries(prepare_result.group_index_canister_id, prepare_result.group_chats_added).await;

    let result = RUNTIME_STATE.with(|state| {
        finalize(
            None,
            summaries,
            GroupChatSummaryUpdatesList::default(),
            state.borrow().as_ref().unwrap(),
        )
    });

    initial_state::Response::Success(initial_state::SuccessResult {
        timestamp: result.timestamp,
        chats: result.chats_added,
        transactions: result.transactions,
        blocked_users: result.blocked_users,
        cycles_balance: result.cycles_balance.unwrap_or(0),
    })
}

#[query]
async fn updates(args: updates::Args) -> updates::Response {
    let prepare_result = RUNTIME_STATE.with(|state| prepare(Some(&args.updates_since), state.borrow().as_ref().unwrap()));

    let summaries_future = get_group_chat_summaries(prepare_result.group_index_canister_id, prepare_result.group_chats_added);
    let summary_updates_future = get_group_chat_summary_updates(
        prepare_result.group_index_canister_id,
        prepare_result.duration_since_last_sync,
        prepare_result.group_chats_to_check_for_updates,
    );

    let (summaries, summary_updates) = futures::future::join(summaries_future, summary_updates_future).await;

    let result = RUNTIME_STATE.with(|state| {
        finalize(
            Some(&args.updates_since),
            summaries,
            summary_updates,
            state.borrow().as_ref().unwrap(),
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
    runtime_state.trap_if_caller_not_owner();

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

#[derive(Default)]
struct GroupChatSummaryList {
    summaries: Vec<Summary>,
    deleted_groups: Vec<DeletedGroupInfo>,
}

async fn get_group_chat_summaries(group_index_canister_id: CanisterId, chat_ids: Vec<ChatId>) -> GroupChatSummaryList {
    if chat_ids.is_empty() {
        return GroupChatSummaryList::default();
    }

    let args = c2c_deleted_groups::Args {
        chat_ids: chat_ids.iter().copied().collect(),
    };
    let deleted_groups = match group_index_canister_c2c_client::c2c_deleted_groups(group_index_canister_id, &args).await {
        Ok(c2c_deleted_groups::Response::Success(r)) => r.deleted_groups,
        Err(error) => {
            error!(?error, "Failed to get deleted groups");
            Vec::new()
        }
    };

    let args = group_canister::summary::Args {};
    let futures: Vec<_> = chat_ids
        .iter()
        .filter(|id| !has_group_been_deleted(&deleted_groups, id))
        .map(|chat_id| group_canister_c2c_client::summary((*chat_id).into(), &args))
        .collect();

    let responses = futures::future::join_all(futures).await;

    let mut summaries = Vec::new();
    for response in responses.into_iter().flatten() {
        if let group_canister::summary::Response::Success(result) = response {
            summaries.push(result.summary);
        }
    }

    GroupChatSummaryList {
        summaries,
        deleted_groups,
    }
}

#[derive(Default)]
struct GroupChatSummaryUpdatesList {
    summary_updates: Vec<SummaryUpdates>,
    deleted_groups: Vec<DeletedGroupInfo>,
}

async fn get_group_chat_summary_updates(
    group_index_canister_id: CanisterId,
    duration_since_last_sync: Milliseconds,
    group_chats: Vec<(ChatId, TimestampMillis)>,
) -> GroupChatSummaryUpdatesList {
    if group_chats.is_empty() {
        return GroupChatSummaryUpdatesList::default();
    }

    let args = c2c_active_and_deleted_groups::Args {
        chat_ids: group_chats.iter().map(|g| g.0).collect(),
        active_in_last: duration_since_last_sync,
    };
    let (active_groups, deleted_groups) =
        match group_index_canister_c2c_client::c2c_active_and_deleted_groups(group_index_canister_id, &args).await {
            Ok(c2c_active_and_deleted_groups::Response::Success(r)) => (r.active_groups, r.deleted_groups),
            Err(error) => {
                error!(?error, "Failed to get active and deleted groups");
                (Vec::new(), Vec::new())
            }
        };

    if active_groups.is_empty() {
        return GroupChatSummaryUpdatesList {
            summary_updates: Vec::new(),
            deleted_groups,
        };
    }

    async fn get_summary_updates(
        canister_id: CanisterId,
        args: group_canister::summary_updates::Args,
    ) -> CallResult<group_canister::summary_updates::Response> {
        group_canister_c2c_client::summary_updates(canister_id, &args).await
    }

    let active_groups_set: HashSet<_> = active_groups.into_iter().collect();

    let futures: Vec<_> = group_chats
        .into_iter()
        .filter(|(g, _)| active_groups_set.contains(g))
        .map(|(g, t)| {
            let args = group_canister::summary_updates::Args { updates_since: t };
            get_summary_updates(g.into(), args)
        })
        .collect();

    let responses = futures::future::join_all(futures).await;

    let mut summary_updates = Vec::new();
    for response in responses.into_iter().flatten() {
        if let group_canister::summary_updates::Response::Success(result) = response {
            summary_updates.push(result.updates);
        }
    }

    GroupChatSummaryUpdatesList {
        summary_updates,
        deleted_groups,
    }
}

fn finalize(
    updates_since_option: Option<&UpdatesSince>,
    group_chats_added: GroupChatSummaryList,
    group_chats_updated: GroupChatSummaryUpdatesList,
    runtime_state: &RuntimeState,
) -> updates::SuccessResult {
    let now = runtime_state.env.now();
    let updates_since = updates_since_option
        .as_ref()
        .map_or(TimestampMillis::default(), |s| s.timestamp);

    let mut groups_deleted: Vec<_> = group_chats_added.deleted_groups.iter().copied().collect();
    groups_deleted.extend(group_chats_updated.deleted_groups);

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

    let mut group_chats_added: HashMap<ChatId, GroupChatSummary> = group_chats_added
        .summaries
        .into_iter()
        .map(|s| (s.chat_id, s.into()))
        .collect();

    let mut group_chats_updated: HashMap<ChatId, GroupChatSummaryUpdates> = group_chats_updated
        .summary_updates
        .into_iter()
        .map(|s| (s.chat_id, s.into()))
        .collect();

    for group_chat in runtime_state
        .data
        .group_chats
        .get_all(updates_since_option.as_ref().map(|s| s.timestamp))
    {
        if has_group_been_deleted(&groups_deleted, &group_chat.chat_id) {
            continue;
        }

        if let Occupied(e) = group_chats_added.entry(group_chat.chat_id) {
            let summary = e.into_mut();
            summary.notifications_muted = group_chat.notifications_muted.value;
            summary.read_by_me = convert_to_message_index_ranges(group_chat.read_by_me.value.clone());
            continue;
        }

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

    let mut chats_added: Vec<_> = group_chats_added.into_values().map(ChatSummary::Group).collect();
    let mut chats_updated: Vec<_> = group_chats_updated.into_values().map(ChatSummaryUpdates::Group).collect();

    for direct_chat in runtime_state
        .data
        .direct_chats
        .get_all(updates_since_option.as_ref().map(|s| s.timestamp))
    {
        if direct_chat.date_created > updates_since {
            chats_added.push(ChatSummary::Direct(DirectChatSummary {
                them: direct_chat.them,
                latest_message: direct_chat.events.latest_message().unwrap(),
                latest_event_index: direct_chat.events.last().index,
                date_created: direct_chat.date_created,
                read_by_me: convert_to_message_index_ranges(direct_chat.read_by_me.value.clone()),
                read_by_them: convert_to_message_index_ranges(direct_chat.read_by_them.value.clone()),
                notifications_muted: direct_chat.notifications_muted.value,
            }));
        } else {
            let latest_message = direct_chat.events.latest_message_if_updated(updates_since);
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

            chats_updated.push(ChatSummaryUpdates::Direct(DirectChatSummaryUpdates {
                chat_id: direct_chat.them.into(),
                latest_message,
                latest_event_index,
                read_by_me,
                read_by_them,
                notifications_muted,
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

    updates::SuccessResult {
        timestamp: now,
        chats_added,
        chats_updated,
        chats_removed,
        transactions,
        blocked_users,
        cycles_balance,
    }
}

fn has_group_been_deleted(groups: &[DeletedGroupInfo], group_id: &ChatId) -> bool {
    groups.iter().any(|g| g.id == *group_id)
}
