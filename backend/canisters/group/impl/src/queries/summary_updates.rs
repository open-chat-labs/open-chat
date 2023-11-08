use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use group_canister::summary_updates::{Response::*, *};
use ic_cdk_macros::query;
use types::{GroupCanisterGroupChatSummaryUpdates, GroupMembershipUpdates, OptionUpdate, MAX_THREADS_IN_SUMMARY};

#[query]
fn summary_updates(args: Args) -> Response {
    read_state(|state| summary_updates_impl(args, state))
}

#[query_msgpack]
fn c2c_summary_updates(args: Args) -> Response {
    read_state(|state| summary_updates_impl(args, state))
}

fn summary_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let member = match state.data.get_member(caller) {
        None => return CallerNotInGroup,
        Some(p) => p,
    };

    let chat = &state.data.chat;
    let chat_last_updated = chat.last_updated(Some(member.user_id));

    if chat_last_updated <= args.updates_since {
        return SuccessNoUpdates;
    }

    let updates = chat.summary_updates(args.updates_since, Some(member.user_id));

    let membership = GroupMembershipUpdates {
        role: updates.role_changed.then_some(member.role.value.into()),
        mentions: updates.mentions,
        notifications_muted: member.notifications_muted.if_set_after(args.updates_since).cloned(),
        my_metrics: state
            .data
            .chat
            .events
            .user_metrics(&member.user_id, Some(args.updates_since))
            .map(|m| m.hydrate()),
        latest_threads: chat.events.latest_threads(
            member.min_visible_event_index(),
            member.threads.iter(),
            Some(args.updates_since),
            MAX_THREADS_IN_SUMMARY,
            member.user_id,
        ),
        unfollowed_threads: chat.events.unfollowed_threads_since(
            member.unfollowed_threads.iter(),
            args.updates_since,
            member.user_id,
        ),
        rules_accepted: member
            .rules_accepted
            .as_ref()
            .filter(|accepted| updates.rules_changed || accepted.timestamp > args.updates_since)
            .map(|accepted| accepted.value >= chat.rules.text.version),
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
            latest_threads: membership.latest_threads.clone(),
            unfollowed_threads: membership.unfollowed_threads.clone(),
            notifications_muted: membership.notifications_muted,
            frozen: state
                .data
                .frozen
                .if_set_after(args.updates_since)
                .cloned()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            wasm_version: None,
            date_last_pinned: updates.date_last_pinned,
            events_ttl: updates.events_ttl,
            events_ttl_last_updated: updates.events_ttl_last_updated,
            gate: updates.gate,
            rules_accepted: membership.rules_accepted,
            membership: Some(membership),
        },
    })
}
