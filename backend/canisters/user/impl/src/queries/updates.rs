use std::collections::HashSet;

use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_community_user::BotUpdate;
use types::{InstalledBotDetails, OptionUpdate, TimestampMillis, UserId};
use user_canister::updates::{Response::*, *};
use utils::time::{today, tomorrow};

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
        || state.data.direct_chats.any_updated(updates_since)
        || state.data.group_chats.any_updated(updates_since)
        || state.data.favourite_chats.any_updated(updates_since)
        || state.data.communities.any_updated(updates_since)
        || state.data.chit_events.last_updated() > updates_since
        || state.data.achievements_last_seen > updates_since
        || state.data.message_activity_events.last_updated() > updates_since
        || state.data.bots.last_updated() > updates_since
        || state.data.bot_api_keys.last_updated() > updates_since;

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

    let direct_chats = DirectChatsUpdates {
        added: direct_chats_added,
        updated: direct_chats_updated,
        removed: state.data.direct_chats.removed_since(updates_since),
        pinned: state.data.direct_chats.pinned_if_updated(updates_since),
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
        pinned: state.data.group_chats.pinned_if_updated(updates_since),
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
        pinned: state.data.favourite_chats.pinned_if_updated(updates_since),
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

    let total_chit_earned = state.data.chit_events.total_chit_earned();
    let chit_balance = state.data.chit_events.balance_for_month_by_timestamp(now);
    let streak = state.data.streak.days(now);
    let next_daily_claim = if state.data.streak.can_claim(now) { today(now) } else { tomorrow(now) };
    let streak_ends = state.data.streak.ends();
    let is_unique_person = is_unique_person_updated.then_some(true);
    let activity_feed = (state.data.message_activity_events.last_updated() > updates_since)
        .then(|| state.data.message_activity_events.summary());
    let streak_insurance = if streak_insurance_updated {
        OptionUpdate::from_update(state.data.streak.streak_insurance(now))
    } else {
        OptionUpdate::NoChange
    };

    let mut bots_changed = HashSet::new();
    let mut bots_added_or_updated = Vec::new();
    let mut bots_removed = Vec::new();

    for (user_id, update) in state.data.bots.iter_latest_updates(updates_since) {
        match update {
            BotUpdate::Added | BotUpdate::Updated => {
                if bots_changed.insert(user_id) {
                    if let Some(bot) = state.data.bots.get(&user_id) {
                        bots_added_or_updated.push(InstalledBotDetails {
                            user_id,
                            permissions: bot.permissions.clone(),
                            added_by: bot.added_by,
                        });
                    }
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
        total_chit_earned,
        chit_balance,
        streak,
        streak_ends,
        streak_insurance,
        next_daily_claim,
        is_unique_person,
        wallet_config,
        referrals,
        message_activity_summary: activity_feed,
        bots_added_or_updated,
        bots_removed,
        api_keys_generated: state.data.bot_api_keys.generated_since(updates_since),
    })
}
