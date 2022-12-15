use crate::guards::caller_is_owner;
use crate::model::group_chat::GroupChat;
use crate::{read_state, RuntimeState, WASM_VERSION};
use ic_cdk_macros::query;
use std::collections::HashMap;
use types::{GroupCanisterGroupChatSummary, GroupChatSummary, ThreadSyncDetails, UserId};
use user_canister::initial_state_v2::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn initial_state_v2(args: Args) -> Response {
    read_state(|state| initial_state_impl(args, state))
}

fn initial_state_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let my_user_id: UserId = runtime_state.env.canister_id().into();
    let avatar_id = runtime_state.data.avatar.value.as_ref().map(|a| a.id);
    let blocked_users = runtime_state.data.blocked_users.value.iter().copied().collect();
    let pinned_chats = runtime_state.data.pinned_chats.value.clone();
    let user_canister_wasm_version = WASM_VERSION.with(|version| version.borrow().value);

    let direct_chats = runtime_state
        .data
        .direct_chats
        .iter()
        .map(|d| d.to_summary(my_user_id))
        .collect();

    let disable_cache = args.disable_cache.unwrap_or_default();

    if let Some(cached) = (!disable_cache)
        .then_some(runtime_state.data.cached_group_summaries.as_ref())
        .flatten()
    {
        // We must handle the scenario where some groups are missing from the cache due to them
        // being inaccessible while the cache was refreshed. To do this, we get all groups, and any
        // groups not found in the cache are included in `group_chats_added`.
        let mut group_chats: HashMap<_, _> = runtime_state.data.group_chats.get_all(None).map(|g| (g.chat_id, g)).collect();

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
            avatar_id,
            blocked_users,
            pinned_chats,
            user_canister_wasm_version,
        })
    } else {
        let group_chats = runtime_state.data.group_chats.iter().map(|g| g.to_summary()).collect();

        Success(SuccessResult {
            timestamp: now,
            direct_chats,
            group_chats,
            avatar_id,
            blocked_users,
            pinned_chats,
            user_canister_wasm_version,
        })
    }
}

fn hydrate_cached_summary(cached: &GroupCanisterGroupChatSummary, user_details: &GroupChat) -> GroupChatSummary {
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
        read_by_me_up_to: user_details.read_by_me_up_to.value,
        notifications_muted: cached.notifications_muted,
        participant_count: cached.participant_count,
        role: cached.role,
        mentions: cached.mentions.clone(),
        wasm_version: cached.wasm_version,
        owner_id: cached.owner_id,
        permissions: cached.permissions.clone(),
        metrics: cached.metrics.clone(),
        my_metrics: cached.my_metrics.clone(),
        latest_threads: cached
            .latest_threads
            .iter()
            .map(|t| ThreadSyncDetails {
                root_message_index: t.root_message_index,
                latest_event: Some(t.latest_event),
                latest_message: Some(t.latest_message),
                read_up_to: user_details.threads_read.get(&t.root_message_index).map(|r| r.value),
                last_updated: t.last_updated,
            })
            .collect(),
        archived: user_details.archived.value,
        frozen: cached.frozen.clone(),
    }
}
