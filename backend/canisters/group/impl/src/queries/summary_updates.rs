use crate::{read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::query;
use group_canister::summary_updates::{Response::*, *};
use types::{
    GroupCanisterGroupChatSummaryUpdates, GroupMembershipUpdates, OptionUpdate, TimestampMillis, MAX_THREADS_IN_SUMMARY,
};

#[query(candid = true, msgpack = true)]
fn summary_updates(args: Args) -> Response {
    read_state(|state| summary_updates_impl(args.updates_since, args.on_behalf_of, state))
}

#[query(msgpack = true)]
fn c2c_summary_updates(args: Args) -> Response {
    read_state(|state| summary_updates_impl(args.updates_since, args.on_behalf_of, state))
}

fn summary_updates_impl(updates_since: TimestampMillis, on_behalf_of: Option<Principal>, state: &RuntimeState) -> Response {
    let caller = if let Some(principal) = on_behalf_of {
        assert!(state.is_caller_local_user_index());
        principal
    } else {
        state.env.caller()
    };

    let member = match state.data.get_member(caller) {
        None => return CallerNotInGroup,
        Some(p) => p,
    };

    let chat = &state.data.chat;
    let chat_last_updated = chat.last_updated(Some(member.user_id()));

    if chat_last_updated <= updates_since {
        return SuccessNoUpdates;
    }

    let updates = chat.summary_updates(updates_since, Some(member.user_id()));

    let membership = GroupMembershipUpdates {
        role: updates.role_changed.then_some(member.role().value.into()),
        mentions: updates.mentions,
        notifications_muted: member.notifications_muted.if_set_after(updates_since).cloned(),
        my_metrics: state
            .data
            .chat
            .events
            .user_metrics(&member.user_id(), Some(updates_since))
            .map(|m| m.hydrate()),
        latest_threads: member
            .followed_threads
            .updated_since(updates_since)
            .filter_map(|(i, _)| state.data.chat.events.thread_details(i))
            .take(MAX_THREADS_IN_SUMMARY)
            .collect(),
        unfollowed_threads: member
            .unfollowed_threads
            .updated_since(updates_since)
            .map(|(i, _)| *i)
            .collect(),
        rules_accepted: member
            .rules_accepted
            .as_ref()
            .filter(|accepted| updates.rules_changed || accepted.timestamp > updates_since)
            .map(|accepted| accepted.value >= chat.rules.text.version),
        lapsed: member.lapsed().if_set_after(updates_since).copied(),
    };

    Success(SuccessResult {
        updates: GroupCanisterGroupChatSummaryUpdates {
            chat_id: state.env.canister_id().into(),
            last_updated: chat_last_updated,
            name: updates.name,
            description: updates.description,
            subtype: updates.subtype,
            avatar_id: updates.avatar_id,
            latest_message: updates.latest_message,
            latest_event_index: updates.latest_event_index,
            latest_message_index: updates.latest_message_index,
            participant_count: updates.member_count,
            role: membership.role,
            mentions: membership.mentions.clone(),
            permissions_v2: updates.permissions,
            updated_events: updates.updated_events,
            metrics: Some(chat.events.metrics().hydrate()),
            my_metrics: membership.my_metrics.clone(),
            is_public: updates.is_public,
            messages_visible_to_non_members: updates.messages_visible_to_non_members,
            latest_threads: membership.latest_threads.clone(),
            unfollowed_threads: membership.unfollowed_threads.clone(),
            notifications_muted: membership.notifications_muted,
            frozen: state
                .data
                .frozen
                .if_set_after(updates_since)
                .cloned()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            wasm_version: None,
            date_last_pinned: updates.date_last_pinned,
            events_ttl: updates.events_ttl,
            events_ttl_last_updated: updates.events_ttl_last_updated,
            gate: updates.gate,
            gate_config: updates.gate_config,
            rules_accepted: membership.rules_accepted,
            membership: Some(membership),
            video_call_in_progress: updates.video_call_in_progress,
        },
    })
}
