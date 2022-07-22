use crate::{CachedGroupSummaries, Data};
use group_index_canister::c2c_filter_groups;
use ic_cdk::api::call::CallResult;
use std::collections::{HashMap, HashSet};
use types::{CanisterId, ChatId, DeletedGroupInfo, GroupChatSummaryInternal, GroupChatSummaryUpdatesInternal, TimestampMillis};
use user_canister::updates::UpdatesSince;

pub(crate) struct SummariesArgs {
    group_index_canister_id: CanisterId,
    group_chat_ids: Vec<ChatId>,
    cached_group_summaries: Option<CachedGroupSummaries>,
    now: TimestampMillis,
}

pub(crate) struct Summaries {
    pub groups: Vec<GroupChatSummaryInternal>,
    pub upgrades_in_progress: Vec<ChatId>,
}

pub(crate) struct UpdatesArgs {
    group_index_canister_id: CanisterId,
    updates_since: UpdatesSince,
    group_chat_ids: Vec<ChatId>,
    now: TimestampMillis,
}

pub(crate) struct Updates {
    pub added: Vec<GroupChatSummaryInternal>,
    pub updated: Vec<GroupChatSummaryUpdatesInternal>,
    pub deleted: Vec<DeletedGroupInfo>,
    pub upgrades_in_progress: Vec<ChatId>,
}

pub(crate) fn build_summaries_args(now: TimestampMillis, data: &Data) -> SummariesArgs {
    SummariesArgs {
        group_index_canister_id: data.group_index_canister_id,
        group_chat_ids: data.group_chats.iter().map(|g| g.chat_id).collect(),
        cached_group_summaries: data.cached_group_summaries.clone(),
        now,
    }
}

pub(crate) fn build_updates_args(updates_since: UpdatesSince, now: TimestampMillis, data: &Data) -> UpdatesArgs {
    UpdatesArgs {
        group_index_canister_id: data.group_index_canister_id,
        updates_since,
        group_chat_ids: data.group_chats.iter().map(|g| g.chat_id).collect(),
        now,
    }
}

pub(crate) async fn summaries(args: SummariesArgs) -> Result<Summaries, String> {
    let updates_args = UpdatesArgs {
        group_index_canister_id: args.group_index_canister_id,
        updates_since: args
            .cached_group_summaries
            .as_ref()
            .map_or(UpdatesSince::default(), |c| c.updates_args()),
        group_chat_ids: args.group_chat_ids,
        now: args.now,
    };

    let updates = updates(updates_args).await?;

    let groups = if let Some(cached) = args.cached_group_summaries {
        let mut merged = merge_updates(cached.groups, updates.updated);
        merged.extend(updates.added);
        merged
    } else {
        updates.added
    };

    Ok(Summaries {
        groups,
        upgrades_in_progress: updates.upgrades_in_progress,
    })
}

pub(crate) async fn updates(args: UpdatesArgs) -> Result<Updates, String> {
    let group_chat_args_map: HashMap<_, _> = args
        .updates_since
        .group_chats
        .iter()
        .map(|g| (g.chat_id, g.updates_since))
        .collect();

    let mut group_chats_added = Vec::new();
    let mut group_chats_to_check_for_updates = Vec::new();

    // TODO handle groups that the user has been removed from
    for chat_id in args.group_chat_ids {
        if let Some(updates_since) = group_chat_args_map.get(&chat_id) {
            group_chats_to_check_for_updates.push((chat_id, *updates_since));
        } else {
            group_chats_added.push(chat_id);
        }
    }

    let mut all_groups: Vec<_> = group_chats_added.clone();
    all_groups.extend(group_chats_to_check_for_updates.iter().map(|(id, _)| *id));

    let mut added = Vec::new();
    let mut updated = Vec::new();
    let mut deleted = Vec::new();
    let mut upgrades_in_progress = Vec::new();
    if !all_groups.is_empty() {
        let duration_since_last_sync = if args.updates_since.timestamp == 0 {
            None
        } else {
            Some(args.now.saturating_sub(args.updates_since.timestamp))
        };

        let filter_groups_args = c2c_filter_groups::Args {
            chat_ids: all_groups,
            active_in_last: duration_since_last_sync,
        };
        let filter_groups_result =
            match group_index_canister_c2c_client::c2c_filter_groups(args.group_index_canister_id, &filter_groups_args).await {
                Ok(group_index_canister::c2c_filter_groups::Response::Success(result)) => result,
                Err(error) => return Err(format!("Failed to call 'c2c_filter_groups': {error:?}")),
            };

        let active_groups: HashSet<_> = filter_groups_result.active_groups.into_iter().collect();
        group_chats_added.retain(|id| {
            !has_group_been_deleted(&filter_groups_result.deleted_groups, id) && !upgrades_in_progress.contains(id)
        });
        group_chats_to_check_for_updates.retain(|(id, _)| active_groups.contains(id) && !upgrades_in_progress.contains(id));

        let summaries_future = c2c::summaries(group_chats_added);
        let summary_updates_future = c2c::summary_updates(group_chats_to_check_for_updates);

        let (s, su) = futures::future::join(summaries_future, summary_updates_future).await;

        added = s;
        updated = su;
        deleted = filter_groups_result
            .deleted_groups
            .into_iter()
            .filter(|g| g.timestamp > args.updates_since.timestamp)
            .collect();
        upgrades_in_progress = filter_groups_result.upgrades_in_progress;
    }

    Ok(Updates {
        added,
        updated,
        deleted,
        upgrades_in_progress,
    })
}

fn merge_updates(
    summaries: Vec<GroupChatSummaryInternal>,
    updates: Vec<GroupChatSummaryUpdatesInternal>,
) -> Vec<GroupChatSummaryInternal> {
    if updates.is_empty() {
        summaries
    } else {
        let mut updates_map: HashMap<_, _> = updates.into_iter().map(|s| (s.chat_id, s)).collect();

        summaries
            .into_iter()
            .map(|s| if let Some(u) = updates_map.remove(&s.chat_id) { s.merge(u) } else { s })
            .collect()
    }
}

fn has_group_been_deleted(groups: &[DeletedGroupInfo], group_id: &ChatId) -> bool {
    groups.iter().any(|g| g.id == *group_id)
}

mod c2c {
    use super::*;

    pub async fn summaries(chat_ids: Vec<ChatId>) -> Vec<GroupChatSummaryInternal> {
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

    pub async fn summary_updates(group_chats: Vec<(ChatId, TimestampMillis)>) -> Vec<GroupChatSummaryUpdatesInternal> {
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
}
