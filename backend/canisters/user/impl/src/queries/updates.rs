use crate::group_summaries::{build_summaries_args, build_updates_args};
use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState, WASM_VERSION};
use ic_cdk_macros::query;
use std::collections::{HashMap, HashSet};
use types::{
    ChatId, ChatSummary, ChatSummaryUpdates, DeletedGroupInfo, GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates, GroupChatSummary, GroupChatSummaryUpdates, OptionUpdate, TimestampMillis,
};
use user_canister::{initial_state, updates};

#[query(guard = "caller_is_owner")]
async fn initial_state(args: initial_state::Args) -> initial_state::Response {
    let disable_cache = args.disable_cache.unwrap_or_default();
    let group_summaries_args = read_state(|state| build_summaries_args(disable_cache, state.env.now(), &state.data));

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
                blocked_users: result.blocked_users_v2.unwrap_or_default(),
                cycles_balance: 0,
                upgrades_in_progress: result.upgrades_in_progress,
                user_canister_wasm_version: WASM_VERSION.with(|v| **v.borrow()),
                pinned_chats: result.pinned_chats.unwrap_or_default(),
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
    group_chats_added: Vec<GroupCanisterGroupChatSummary>,
    group_chats_updated: Vec<GroupCanisterGroupChatSummaryUpdates>,
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
            summary.read_by_me_up_to = group_chat.read_by_me_up_to.value;
            summary.archived = group_chat.archived.value;

            for thread in summary.latest_threads.iter_mut() {
                thread.read_up_to = group_chat.threads_read.get(&thread.root_message_index).map(|v| v.value);
            }
        } else {
            group_chats_updated
                .entry(group_chat.chat_id)
                .and_modify(|su| {
                    su.read_by_me_up_to = group_chat.read_by_me_up_to.if_set_after(updates_since).copied().flatten();
                    su.archived = group_chat.archived.if_set_after(updates_since).copied();

                    for thread in su.latest_threads.iter_mut() {
                        thread.read_up_to = group_chat.threads_read.get(&thread.root_message_index).map(|v| v.value);
                    }
                })
                .or_insert_with(|| group_chat.to_updates(updates_since));
        }
    }

    let mut chats_added: Vec<_> = group_chats_added.into_values().map(ChatSummary::Group).collect();
    let mut chats_updated: Vec<_> = group_chats_updated.into_values().map(ChatSummaryUpdates::Group).collect();

    let my_user_id = runtime_state.env.canister_id().into();

    for direct_chat in runtime_state.data.direct_chats.get_all(Some(updates_since)) {
        if direct_chat.date_created > updates_since {
            chats_added.push(ChatSummary::Direct(direct_chat.to_summary(my_user_id)));
        } else {
            chats_updated.push(ChatSummaryUpdates::Direct(
                direct_chat.to_summary_updates(updates_since, my_user_id),
            ));
        }
    }

    let blocked_users_v2 = runtime_state
        .data
        .blocked_users
        .if_set_after(updates_since)
        .map(|user_ids| user_ids.iter().copied().collect());

    let pinned_chats = runtime_state.data.pinned_chats.if_set_after(updates_since).cloned();

    let avatar_id = runtime_state
        .data
        .avatar
        .if_set_after(updates_since)
        .map_or(OptionUpdate::NoChange, |update| {
            OptionUpdate::from_update(update.as_ref().map(|a| a.id))
        });

    updates::SuccessResult {
        timestamp: now,
        chats_added,
        chats_updated,
        chats_removed,
        cycles_balance: None,
        avatar_id,
        upgrades_in_progress: group_chat_upgrades_in_progress,
        user_canister_wasm_version: WASM_VERSION.with(|v| v.borrow().if_set_after(updates_since).copied()),
        blocked_users_v2,
        pinned_chats,
    }
}

fn has_group_been_deleted(groups: &[DeletedGroupInfo], group_id: &ChatId) -> bool {
    groups.iter().any(|g| g.id == *group_id)
}
