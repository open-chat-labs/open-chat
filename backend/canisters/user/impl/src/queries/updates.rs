use crate::guards::caller_is_owner;
use crate::{RuntimeState, merge_maps, read_state, sorted_pinned};
use canister_api_macros::query;
use installed_bots::BotUpdate;
use std::collections::HashSet;
use types::{InstalledBotDetails, OptionUpdate, TimestampMillis, UserId};
use user_canister::updates::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn updates(args: Args) -> Response {
    read_state(|state| updates_impl(args.updates_since, state))
}

fn updates_impl(updates_since: TimestampMillis, state: &RuntimeState) -> Response {
    let username = state.data.username.if_set_after(updates_since).cloned();
    let suspended = state.data.suspended.if_set_after(updates_since).cloned();

    let display_name = state
        .data
        .display_name
        .if_set_after(updates_since)
        .map_or(OptionUpdate::NoChange, |update| OptionUpdate::from_update(update.clone()));

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

    let pin_number_updated = state.data.pin_number.last_updated() > updates_since;
    let is_unique_person_updated = state
        .data
        .unique_person_proof
        .as_ref()
        .is_some_and(|p| p.timestamp > updates_since);

    let wallet_config = state.data.wallet_config.if_set_after(updates_since).cloned();
    let referrals = state.data.referrals.updated_since(updates_since);
    let streak_insurance_updated = state.data.streak.insurance_last_updated() > updates_since;
    let btc_address_if_updated = state
        .data
        .btc_address
        .as_ref()
        .filter(|a| a.timestamp > updates_since)
        .map(|a| a.value.clone());
    let one_sec_address_if_updated = state
        .data
        .one_sec_address
        .as_ref()
        .filter(|a| a.timestamp > updates_since)
        .map(|a| a.value.clone());
    let premium_items_updated = state.data.premium_items.last_updated() > updates_since;

    let has_any_updates = username.is_some()
        || display_name.has_update()
        || avatar_id.has_update()
        || blocked_users.is_some()
        || avatar_id.has_update()
        || suspended.is_some()
        || wallet_config.is_some()
        || pin_number_updated
        || is_unique_person_updated
        || !referrals.is_empty()
        || streak_insurance_updated
        || btc_address_if_updated.is_some()
        || one_sec_address_if_updated.is_some()
        || premium_items_updated
        || state.data.direct_chats.any_updated(updates_since)
        || state.data.group_chats.any_updated(updates_since)
        || state.data.favourite_chats.any_updated(updates_since)
        || state.data.communities.any_updated(updates_since)
        || state.data.chit_events.last_updated() > updates_since
        || state.data.achievements_last_seen > updates_since
        || state.data.message_activity_events.last_updated() > updates_since
        || state.data.bots.last_updated() > updates_since;

    // Short circuit prior to calling `ic0.time()` so that caching works effectively
    if !has_any_updates {
        return SuccessNoUpdates;
    }

    let now = state.env.now();
    let my_user_id: UserId = state.env.canister_id().into();

    let mut direct_chats_added = Vec::new();
    let mut direct_chats_updated = Vec::new();

    for direct_chat in state.data.direct_chats.updated_since(updates_since) {
        if direct_chat.date_created > updates_since {
            direct_chats_added.push(direct_chat.to_summary(my_user_id));
        } else {
            direct_chats_updated.push(direct_chat.to_summary_updates(updates_since, my_user_id));
        }
    }

    let direct_pinned = state.data.direct_chats.pinned_chats_if_updated(updates_since);
    let group_pinned = state.data.group_chats.pinned_chats_if_updated(updates_since);
    let merged_pinned = match (&direct_pinned, &group_pinned) {
        (Some(direct), Some(group)) => Some(sorted_pinned(&merge_maps(direct, group))),
        (Some(direct), None) => Some(sorted_pinned(&merge_maps(direct, &state.data.group_chats.pinned_chats()))),
        (None, Some(group)) => Some(sorted_pinned(&merge_maps(&state.data.direct_chats.pinned_chats(), group))),
        _ => None,
    };

    let direct_chats = DirectChatsUpdates {
        added: direct_chats_added,
        updated: direct_chats_updated,
        removed: state.data.direct_chats.removed_since(updates_since),
        pinned: state
            .data
            .direct_chats
            .pinned_if_updated(updates_since)
            .map(|m| sorted_pinned(&m)),
    };

    let group_chats_removed = state.data.group_chats.removed_since(updates_since);
    let mut group_chats_added = Vec::new();
    let mut group_chats_updated = Vec::new();
    for group_chat in state.data.group_chats.updated_since(updates_since) {
        if group_chat.date_joined > updates_since {
            group_chats_added.push(group_chat.to_summary());
        } else {
            group_chats_updated.push(group_chat.to_summary_updates(updates_since));
        }
    }

    let group_chats = GroupChatsUpdates {
        added: group_chats_added,
        updated: group_chats_updated,
        removed: group_chats_removed,
        pinned: state
            .data
            .group_chats
            .pinned_if_updated(updates_since)
            .map(|m| sorted_pinned(&m)),
    };

    let communities_removed = state.data.communities.removed_since(updates_since);
    let mut communities_added = Vec::new();
    let mut communities_updated = Vec::new();
    for community in state.data.communities.updated_since(updates_since) {
        if community.date_joined > updates_since {
            communities_added.push(community.to_summary());
        } else {
            communities_updated.push(community.to_summary_updates(updates_since));
        }
    }

    let communities = CommunitiesUpdates {
        added: communities_added,
        updated: communities_updated,
        removed: communities_removed,
    };

    let favourite_chats = FavouriteChatsUpdates {
        chats: state.data.favourite_chats.chats_if_updated(updates_since),
        pinned: state
            .data
            .favourite_chats
            .pinned_if_updated(updates_since)
            .map(|m| sorted_pinned(&m)),
    };

    let pin_number_settings = if pin_number_updated {
        if state.data.pin_number.enabled() {
            OptionUpdate::SetToSome(state.data.pin_number.settings(now))
        } else {
            OptionUpdate::SetToNone
        }
    } else {
        OptionUpdate::NoChange
    };

    let achievements = state.data.chit_events.achievements(Some(updates_since));
    let achievements_last_seen = if state.data.achievements_last_seen > updates_since {
        Some(state.data.achievements_last_seen)
    } else {
        None
    };

    let message_activity_summary = (state.data.message_activity_events.last_updated() > updates_since)
        .then(|| state.data.message_activity_events.summary());
    let streak_insurance = if streak_insurance_updated {
        OptionUpdate::from_update(state.data.streak.streak_insurance(now))
    } else {
        OptionUpdate::NoChange
    };
    let premium_items = premium_items_updated.then(|| state.data.premium_items.item_ids());

    let mut bots_changed = HashSet::new();
    let mut bots_added_or_updated = Vec::new();
    let mut bots_removed = Vec::new();

    for (user_id, update) in state.data.bots.iter_latest_updates(updates_since) {
        match update {
            BotUpdate::Added | BotUpdate::Updated => {
                if bots_changed.insert(user_id)
                    && let Some(bot) = state.data.bots.get(&user_id)
                {
                    bots_added_or_updated.push(InstalledBotDetails {
                        user_id,
                        added_by: bot.added_by,
                        permissions: bot.permissions.clone(),
                        autonomous_permissions: bot.autonomous_permissions.clone(),
                    });
                }
            }
            BotUpdate::Removed => {
                if bots_changed.insert(user_id) {
                    bots_removed.push(user_id);
                }
            }
        }
    }

    Success(SuccessResult {
        timestamp: now,
        username,
        display_name,
        direct_chats,
        group_chats,
        favourite_chats,
        communities,
        avatar_id,
        blocked_users,
        suspended,
        pin_number_settings,
        achievements,
        achievements_last_seen,
        total_chit_earned: state.data.chit_events.total_chit_earned(),
        chit_balance: state.data.chit_events.chit_balance(),
        streak: state.data.streak.days(now),
        streak_ends: state.data.streak.ends(),
        max_streak: state.data.streak.max_streak(),
        streak_insurance,
        next_daily_claim: state.data.streak.next_claim(),
        is_unique_person: is_unique_person_updated.then_some(true),
        wallet_config,
        referrals,
        message_activity_summary,
        bots_added_or_updated,
        bots_removed,
        btc_address: btc_address_if_updated,
        one_sec_address: one_sec_address_if_updated,
        premium_items,
        pinned_chats: merged_pinned,
    })
}
