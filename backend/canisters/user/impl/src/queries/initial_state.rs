use crate::guards::caller_is_owner;
use crate::model::group_chat::GroupChat;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use std::collections::HashMap;
use types::{GroupCanisterGroupChatSummary, GroupChatSummary, ThreadSyncDetails, UserId, Version};
use user_canister::initial_state::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn initial_state(args: Args) -> Response {
    read_state(|state| initial_state_impl(args, state))
}

#[query(guard = "caller_is_owner")]
fn initial_state_v2(args: Args) -> user_canister::initial_state_v2::Response {
    read_state(|state| initial_state_impl(args, state)).into()
}

fn initial_state_impl(args: Args, state: &RuntimeState) -> Response {
    let now = state.env.now();
    let my_user_id: UserId = state.env.canister_id().into();
    let avatar_id = state.data.avatar.value.as_ref().map(|a| a.id);
    let blocked_users = state.data.blocked_users.value.iter().copied().collect();
    let pinned_chats = state.data.pinned_chats.value.clone();

    let direct_chats = state
        .data
        .direct_chats
        .iter()
        .map(|d| d.to_summary(my_user_id, now))
        .collect();

    let communities = state.data.communities.iter().map(|c| c.to_summary()).collect();

    let disable_cache = args.disable_cache.unwrap_or_default();

    if let Some(cached) = (!disable_cache)
        .then_some(state.data.cached_group_summaries.as_ref())
        .flatten()
    {
        // We must handle the scenario where some groups are missing from the cache due to them
        // being inaccessible while the cache was refreshed. To do this, we get all groups, and any
        // groups not found in the cache are included in `group_chats_added`.
        let mut group_chats: HashMap<_, _> = state.data.group_chats.iter().map(|g| (g.chat_id, g)).collect();

        SuccessCached(SuccessCachedResult {
            timestamp: now,
            direct_chats,
            cache_timestamp: cached.timestamp,
            cached_group_chat_summaries: cached
                .groups
                .iter()
                .filter_map(|c| group_chats.remove(&c.chat_id).map(|g| (c, g)))
                .map(|(c, g)| hydrate_cached_summary(c, g))
                .collect(),
            group_chats_added: group_chats.values().map(|g| g.to_summary()).collect(),
            communities,
            avatar_id,
            blocked_users,
            pinned_chats,
        })
    } else {
        let group_chats = state.data.group_chats.iter().map(|g| g.to_summary()).collect();

        Success(SuccessResult {
            timestamp: now,
            direct_chats,
            group_chats,
            communities,
            avatar_id,
            blocked_users,
            pinned_chats,
        })
    }
}

fn hydrate_cached_summary(cached: &GroupCanisterGroupChatSummary, user_details: &GroupChat) -> GroupChatSummary {
    let mut threads = HashMap::new();
    for thread in cached.latest_threads.iter() {
        threads.insert(thread.root_message_index, ThreadSyncDetails::from(thread));
    }
    for (&root_message_index, read_up_to) in user_details.messages_read.threads_read.iter() {
        threads
            .entry(root_message_index)
            .or_insert(ThreadSyncDetails {
                root_message_index,
                latest_event: None,
                latest_message: None,
                read_up_to: None,
                last_updated: 0,
            })
            .read_up_to = Some(read_up_to.value);
    }

    GroupChatSummary {
        chat_id: cached.chat_id,
        last_updated: cached.last_updated,
        name: cached.name.clone(),
        description: cached.description.clone(),
        subtype: cached.subtype.clone(),
        avatar_id: cached.avatar_id,
        is_public: cached.is_public,
        history_visible_to_new_joiners: cached.history_visible_to_new_joiners,
        min_visible_event_index: cached.min_visible_event_index,
        min_visible_message_index: cached.min_visible_message_index,
        latest_message: cached.latest_message.clone(),
        latest_event_index: cached.latest_event_index,
        joined: cached.joined,
        read_by_me_up_to: user_details.messages_read.read_by_me_up_to.value,
        notifications_muted: cached.notifications_muted,
        participant_count: cached.participant_count,
        role: cached.role,
        mentions: cached.mentions.clone(),
        permissions: cached.permissions.clone(),
        metrics: cached.metrics.clone(),
        my_metrics: cached.my_metrics.clone(),
        latest_threads: threads.into_values().collect(),
        archived: user_details.archived.value,
        frozen: cached.frozen.clone(),
        wasm_version: Version::default(),
        date_last_pinned: cached.date_last_pinned,
        date_read_pinned: user_details.messages_read.date_read_pinned.value,
        events_ttl: cached.events_ttl,
        expired_messages: cached.expired_messages.clone(),
        next_message_expiry: cached.next_message_expiry,
    }
}
