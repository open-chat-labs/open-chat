use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use types::{OptionUpdate, TimestampMillis, UserId};
use user_canister::updates::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn updates(args: Args) -> Response {
    read_state(|state| updates_impl(args.updates_since, state))
}

#[query(guard = "caller_is_owner")]
fn updates_v2(args: user_canister::updates_v2::Args) -> user_canister::updates_v2::Response {
    read_state(|state| updates_impl(args.updates_since, state)).into()
}

fn updates_impl(updates_since: TimestampMillis, state: &RuntimeState) -> Response {
    let avatar_id = state
        .data
        .avatar
        .if_set_after(updates_since)
        .map_or(OptionUpdate::NoChange, |update| {
            OptionUpdate::from_update(update.as_ref().map(|a| a.id))
        });

    let blocked_users = state
        .data
        .blocked_users
        .if_set_after(updates_since)
        .map(|user_ids| user_ids.iter().copied().collect());

    let pinned_chats = state.data.pinned_chats.if_set_after(updates_since).cloned();
    let chats_removed = state.data.group_chats.removed_since(updates_since);

    let has_any_updates = avatar_id.has_update()
        || blocked_users.is_some()
        || pinned_chats.is_some()
        || !chats_removed.is_empty()
        || state.data.direct_chats.any_updated(updates_since)
        || state.data.group_chats.any_updated(updates_since);

    // Short circuit prior to calling `ic0.time()` so that caching works effectively
    if !has_any_updates {
        return SuccessNoUpdates;
    }

    let now = state.env.now();
    let my_user_id: UserId = state.env.canister_id().into();

    let mut direct_chats_added = Vec::new();
    let mut direct_chats_updated = Vec::new();

    for direct_chat in state.data.direct_chats.get_all(Some(updates_since), now) {
        if direct_chat.date_created > updates_since {
            direct_chats_added.push(direct_chat.to_summary(my_user_id, now));
        } else {
            direct_chats_updated.push(direct_chat.to_summary_updates(updates_since, my_user_id, now));
        }
    }

    let mut group_chats_added = Vec::new();
    let mut group_chats_updated = Vec::new();
    for group_chat in state.data.group_chats.updated_since(updates_since) {
        if group_chat.date_joined > updates_since {
            group_chats_added.push(group_chat.to_summary());
        } else {
            group_chats_updated.push(group_chat.to_summary_updates(updates_since));
        }
    }

    let mut communities_added = Vec::new();
    let mut communities_updated = Vec::new();
    for community in state.data.communities.updated_since(updates_since) {
        if community.date_joined > updates_since {
            communities_added.push(community.to_summary());
        } else {
            communities_updated.push(community.to_summary_updates(updates_since));
        }
    }

    Success(SuccessResult {
        timestamp: now,
        direct_chats_added,
        direct_chats_updated,
        group_chats_added,
        group_chats_updated,
        communities_added,
        communities_updated,
        chats_removed,
        avatar_id,
        blocked_users,
        pinned_chats,
    })
}
