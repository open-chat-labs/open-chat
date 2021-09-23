use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::query;
use log::error;
use std::collections::{HashMap, HashSet};
use types::{
    CanisterId, ChatId, ChatSummary, ChatSummaryUpdates, DirectChatSummary, DirectChatSummaryUpdates, GroupChatSummary,
    GroupChatSummaryUpdates, Milliseconds, TimestampMillis,
};
use user_canister::updates::{Response::*, *};
use utils::range_set::convert_to_message_index_ranges;

#[query]
async fn updates(args: Args) -> Response {
    let prepare_result = match RUNTIME_STATE.with(|state| prepare(&args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let summaries_future = get_group_chat_summaries(prepare_result.group_chats_added);
    let summary_updates_future = get_group_chat_summary_updates(
        prepare_result.group_index_canister_id,
        prepare_result.duration_since_last_sync,
        prepare_result.group_chats_to_check_for_updates,
    );

    let (summaries, summary_updates) = futures::future::join(summaries_future, summary_updates_future).await;

    let result = RUNTIME_STATE.with(|state| finalize(args, summaries, summary_updates, state.borrow().as_ref().unwrap()));

    Success(result)
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    duration_since_last_sync: Milliseconds,
    group_chats_to_check_for_updates: Vec<(ChatId, TimestampMillis)>,
    group_chats_added: Vec<ChatId>,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    runtime_state.trap_if_caller_not_owner();

    let now = runtime_state.env.now();
    if let Some(updates_since) = &args.updates_since {
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

        Ok(PrepareResult {
            group_index_canister_id: runtime_state.data.group_index_canister_id,
            duration_since_last_sync,
            group_chats_to_check_for_updates,
            group_chats_added,
        })
    } else {
        let new_group_chats = runtime_state.data.group_chats.iter().map(|g| g.chat_id).collect();

        Ok(PrepareResult {
            group_index_canister_id: runtime_state.data.group_index_canister_id,
            duration_since_last_sync: now,
            group_chats_to_check_for_updates: Vec::new(),
            group_chats_added: new_group_chats,
        })
    }
}

async fn get_group_chat_summaries(chat_ids: Vec<ChatId>) -> Vec<GroupChatSummary> {
    if chat_ids.is_empty() {
        return Vec::new();
    }

    let count = chat_ids.len();
    let args = group_canister::summary::Args {};
    let futures: Vec<_> = chat_ids
        .into_iter()
        .map(|g| group_canister_c2c_client::summary(g.into(), &args))
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
    duration_since_last_sync: Milliseconds,
    mut group_chats: Vec<(ChatId, TimestampMillis)>,
) -> Vec<GroupChatSummaryUpdates> {
    if group_chats.len() >= 5 {
        if group_chats.is_empty() {
            return Vec::new();
        }

        let args = group_index_canister::active_groups::Args {
            chat_ids: group_chats.iter().map(|g| g.0).collect(),
            active_in_last: duration_since_last_sync,
        };
        let active_groups = match group_index_canister_c2c_client::active_groups(group_index_canister_id, &args).await {
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
        group_canister_c2c_client::summary_updates(canister_id, &args).await
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
    group_chats_added: Vec<GroupChatSummary>,
    group_chats_updated: Vec<GroupChatSummaryUpdates>,
    runtime_state: &RuntimeState,
) -> SuccessResult {
    let now = runtime_state.env.now();
    let updates_since = args
        .updates_since
        .as_ref()
        .map_or(TimestampMillis::default(), |s| s.timestamp);

    let mut chats_added: Vec<_> = group_chats_added.into_iter().map(ChatSummary::Group).collect();

    let mut chats_updated: Vec<_> = group_chats_updated.into_iter().map(ChatSummaryUpdates::Group).collect();

    for direct_chat in runtime_state
        .data
        .direct_chats
        .get_all(args.updates_since.map(|s| s.timestamp))
    {
        if direct_chat.date_created > updates_since {
            chats_added.push(ChatSummary::Direct(DirectChatSummary {
                them: direct_chat.them,
                latest_message: direct_chat.events.latest_message().unwrap(),
                latest_event_index: direct_chat.events.last().index,
                date_created: direct_chat.date_created,
                read_by_me: convert_to_message_index_ranges(direct_chat.read_by_me.clone()),
                read_by_them: convert_to_message_index_ranges(direct_chat.read_by_them.clone()),
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

            let read_by_me = if direct_chat.read_by_me_updated > updates_since {
                Some(convert_to_message_index_ranges(direct_chat.read_by_me.clone()))
            } else {
                None
            };

            let read_by_them = if direct_chat.read_by_them_updated > updates_since {
                Some(convert_to_message_index_ranges(direct_chat.read_by_them.clone()))
            } else {
                None
            };

            chats_updated.push(ChatSummaryUpdates::Direct(DirectChatSummaryUpdates {
                chat_id: direct_chat.them.into(),
                latest_message,
                latest_event_index,
                read_by_me,
                read_by_them,
            }));
        }
    }

    let blocked_users = runtime_state.data.blocked_users.iter().copied().collect();
    let webrtc_connection_details = runtime_state
        .data
        .webrtc_connection_details_map
        .get_connection_details(updates_since);

    SuccessResult {
        chats_added,
        chats_updated,
        chats_removed: Vec::new(), // TODO
        timestamp: now,
        blocked_users,
        webrtc_connection_details,
    }
}
