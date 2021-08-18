use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::query;
use log::error;
use std::collections::{HashMap, HashSet};
use types::{
    CanisterId, ChatSummary, ChatSummaryUpdates, DirectChatSummary, DirectChatSummaryUpdates, GroupChatId, GroupChatSummary,
    GroupChatSummaryUpdates, TimestampMillis,
};
use user_canister::updates::{Response::*, *};

// If the last sync was longer than a configurable time ago, get all the group chat summary updates.
// This is because we call into the group index canister to see which groups are active and if the
// last sync was long enough ago there may be missed updates from groups which are now marked as
// inactive.
const GET_ALL_GROUP_CHATS_INTERVAL_MS: u64 = 5 * 60 * 1000;

#[query]
async fn updates(args: Args) -> Response {
    let prepare_result = match RUNTIME_STATE.with(|state| prepare(&args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let summaries_future = get_group_chat_summaries(prepare_result.new_group_chats);
    let updated_summaries_future = get_group_chat_summary_updates(
        prepare_result.group_index_canister_id,
        prepare_result.check_active_groups_only,
        prepare_result.group_chats_to_check_for_updates,
    );

    let (summaries, updated_summaries) = futures::future::join(summaries_future, updated_summaries_future).await;

    let result = RUNTIME_STATE.with(|state| finalize(args, summaries, updated_summaries, state.borrow().as_ref().unwrap()));

    Success(result)
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    check_active_groups_only: bool,
    group_chats_to_check_for_updates: Vec<(GroupChatId, TimestampMillis)>,
    new_group_chats: Vec<GroupChatId>,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    if runtime_state.is_caller_owner() {
        if let Some(updates_since) = &args.updates_since {
            let now = runtime_state.env.now();
            let time_since_last_sync = now.saturating_sub(updates_since.timestamp);
            let check_active_groups_only =
                // Avoid going to group index canister if there are < 5 groups as it is a bottleneck
                runtime_state.data.group_chats.len() >= 5 &&
                time_since_last_sync < GET_ALL_GROUP_CHATS_INTERVAL_MS;

            let mut group_chats_to_check_for_updates = Vec::new();
            let mut new_group_chats = Vec::new();
            let group_chat_args_map: HashMap<_, _> = updates_since
                .group_chats
                .iter()
                .map(|g| (g.chat_id, g.updates_since))
                .collect();

            for chat_id in runtime_state.data.group_chats.iter().map(|g| g.chat_id) {
                if let Some(updates_since) = group_chat_args_map.get(&chat_id) {
                    group_chats_to_check_for_updates.push((chat_id, *updates_since));
                } else {
                    new_group_chats.push(chat_id);
                }
            }

            return Ok(PrepareResult {
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                check_active_groups_only,
                group_chats_to_check_for_updates,
                new_group_chats,
            });
        }

        let new_group_chats = runtime_state.data.group_chats.iter().map(|g| g.chat_id).collect();

        Ok(PrepareResult {
            group_index_canister_id: runtime_state.data.group_index_canister_id,
            check_active_groups_only: false,
            group_chats_to_check_for_updates: Vec::new(),
            new_group_chats,
        })
    } else {
        Err(NotAuthorised)
    }
}

async fn get_group_chat_summaries(chat_ids: Vec<GroupChatId>) -> Vec<GroupChatSummary> {
    if chat_ids.is_empty() {
        return Vec::new();
    }

    let count = chat_ids.len();
    let args = group_canister::summary::Args {};
    let futures: Vec<_> = chat_ids
        .into_iter()
        .map(|g| group_canister_client::summary(g.into(), &args))
        .collect();

    let responses = futures::future::join_all(futures).await;

    let mut summaries = Vec::new();
    let mut failures = Vec::new();
    for response in responses.into_iter() {
        match response {
            Ok(result) => {
                if let group_canister::summary::Response::Success(r) = result {
                    summaries.push(r.summary);
                };
            }
            Err(error) => failures.push(error),
        }
    }

    if !failures.is_empty() {
        error!(
            "Error getting group chat summaries. {} chat(s) failed out of {}. First error: {:?}",
            failures.len(),
            count,
            failures.first().unwrap()
        );
    }

    summaries
}

async fn get_group_chat_summary_updates(
    group_index_canister_id: CanisterId,
    active_only: bool,
    mut group_chats: Vec<(GroupChatId, TimestampMillis)>,
) -> Vec<GroupChatSummaryUpdates> {
    if active_only {
        if group_chats.is_empty() {
            return Vec::new();
        }

        let args = group_index_canister::active_groups::Args {
            group_ids: group_chats.iter().map(|g| g.0).collect(),
        };
        let active_groups = match group_index_canister_client::active_groups(group_index_canister_id, &args).await {
            Ok(group_index_canister::active_groups::Response::Success(r)) => r.active_groups,
            Err(error) => {
                error!("Failed to get active groups. {:?}", error);
                Vec::new()
            }
        };

        let active_groups_set: HashSet<_> = active_groups.into_iter().collect();

        group_chats.retain(|(g, _)| active_groups_set.contains(g));
    }

    if group_chats.is_empty() {
        return Vec::new();
    }

    async fn get_summary_updates(
        canister_id: CanisterId,
        args: group_canister::summary_updates::Args,
    ) -> CallResult<group_canister::summary_updates::Response> {
        group_canister_client::summary_updates(canister_id, &args).await
    }

    let count = group_chats.len();
    let futures: Vec<_> = group_chats
        .into_iter()
        .map(|(g, t)| {
            let args = group_canister::summary_updates::Args { updates_since: t };
            get_summary_updates(g.into(), args)
        })
        .collect();

    let responses = futures::future::join_all(futures).await;

    let mut summary_updates = Vec::new();
    let mut failures = Vec::new();
    for response in responses.into_iter() {
        match response {
            Ok(result) => {
                if let group_canister::summary_updates::Response::Success(r) = result {
                    summary_updates.push(r.updates);
                };
            }
            Err(error) => failures.push(error),
        }
    }

    if !failures.is_empty() {
        error!(
            "Error getting group chat summary updates. {} chat(s) failed out of {}. First error: {:?}",
            failures.len(),
            count,
            failures.first().unwrap()
        );
    }

    summary_updates
}

fn finalize(
    args: Args,
    new_group_chats: Vec<GroupChatSummary>,
    updated_group_chats: Vec<GroupChatSummaryUpdates>,
    runtime_state: &RuntimeState,
) -> SuccessResult {
    let now = runtime_state.env.now();
    let updates_since = args
        .updates_since
        .as_ref()
        .map_or(TimestampMillis::default(), |s| s.timestamp);

    let mut new_chats: Vec<_> = new_group_chats.into_iter().map(ChatSummary::Group).collect();

    let mut updated_chats: Vec<_> = updated_group_chats.into_iter().map(ChatSummaryUpdates::Group).collect();

    for direct_chat in runtime_state
        .data
        .direct_chats
        .get_all(args.updates_since.map(|s| s.timestamp))
    {
        if direct_chat.date_created > updates_since {
            new_chats.push(ChatSummary::Direct(DirectChatSummary {
                chat_id: direct_chat.chat_id,
                them: direct_chat.them,
                latest_message: direct_chat.events.latest_message().unwrap(),
                latest_event_index: direct_chat.events.latest_event_index(),
                date_created: direct_chat.date_created,
                latest_read_by_me: *direct_chat.latest_read_by_me.value(),
                latest_read_by_them: *direct_chat.latest_read_by_them.value(),
            }));
        } else {
            let mut latest_message = None;
            if let Some(m) = direct_chat.events.latest_message() {
                if m.timestamp > updates_since {
                    latest_message = Some(m.clone());
                }
            }

            let latest_event = direct_chat.events.last();
            let latest_event_index = if latest_event.timestamp > updates_since { Some(latest_event.index) } else { None };

            let latest_read_by_me = if direct_chat.latest_read_by_me.updated() > updates_since {
                Some(*direct_chat.latest_read_by_me.value())
            } else {
                None
            };

            let latest_read_by_them = if direct_chat.latest_read_by_them.updated() > updates_since {
                Some(*direct_chat.latest_read_by_them.value())
            } else {
                None
            };

            updated_chats.push(ChatSummaryUpdates::Direct(DirectChatSummaryUpdates {
                chat_id: direct_chat.chat_id,
                latest_message,
                latest_event_index,
                latest_read_by_me,
                latest_read_by_them,
            }));
        }
    }

    SuccessResult {
        new_chats,
        updated_chats,
        timestamp: now,
    }
}
