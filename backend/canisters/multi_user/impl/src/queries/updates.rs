use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use types::{OptionUpdate, TimestampMillis};
use user_canister::updates::{Response::*, *};
use user_state::{merge_maps, sorted_pinned};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn updates(args: Args) -> Response {
    read_state(|state| updates_impl(args.updates_since, state))
}

fn updates_impl(updates_since: TimestampMillis, state: &RuntimeState) -> Response {
    state.with_caller_user(|my_index, user| {
        let username = user.username.if_set_after(updates_since).cloned();
        let suspended = user.suspended.if_set_after(updates_since).copied();
        let display_name = user
            .display_name
            .if_set_after(updates_since)
            .map_or(OptionUpdate::NoChange, |update| OptionUpdate::from_update(update.clone()));
        let avatar_id = user
            .avatar
            .id_if_set_after(updates_since)
            .map_or(OptionUpdate::NoChange, OptionUpdate::from_update);
        let blocked_users = user.blocked_users.if_updated_since(updates_since);
        let pin_number_updated = user.pin_number.last_updated() > updates_since;
        let wallet_config = user.wallet_config.if_set_after(updates_since).cloned();
        let message_activity_summary =
            (user.message_activity_events.last_updated() > updates_since).then(|| user.message_activity_events.summary());
        let streak_insurance_updated = user.streak.insurance_last_updated() > updates_since;

        let has_any_updates = username.is_some()
            || display_name.has_update()
            || avatar_id.has_update()
            || blocked_users.is_some()
            || pin_number_updated
            || suspended.is_some()
            || wallet_config.is_some()
            || message_activity_summary.is_some()
            || streak_insurance_updated
            || user.chit_events.last_updated() > updates_since
            || user.achievements_last_seen > updates_since
            || user.favourite_chats.any_updated(updates_since)
            || user.direct_chats.any_updated(updates_since)
            || user.group_chats.any_updated(updates_since)
            || user.communities.any_updated(updates_since);

        // Short circuit prior to calling `ic0.time()` so that caching works effectively
        if !has_any_updates {
            return SuccessNoUpdates;
        }

        let now = state.env.now();
        let my_user_id = state.user_id(my_index);

        let pin_number_settings = if !pin_number_updated {
            OptionUpdate::NoChange
        } else if user.pin_number.enabled() {
            OptionUpdate::SetToSome(user.pin_number.settings(now))
        } else {
            OptionUpdate::SetToNone
        };

        let mut direct_chats_added = Vec::new();
        let mut direct_chats_updated = Vec::new();

        for chat in user.direct_chats.updated_since(updates_since) {
            if chat.date_created() > updates_since {
                direct_chats_added.push(chat.to_summary(my_user_id));
            } else {
                direct_chats_updated.push(chat.to_summary_updates(updates_since, my_user_id));
            }
        }

        let direct_chats = DirectChatsUpdates {
            added: direct_chats_added,
            updated: direct_chats_updated,
            removed: user.direct_chats.removed_since(updates_since),
        };

        let mut group_chats_added = Vec::new();
        let mut group_chats_updated = Vec::new();
        for group_chat in user.group_chats.updated_since(updates_since) {
            if group_chat.date_joined > updates_since {
                group_chats_added.push(group_chat.to_summary());
            } else {
                group_chats_updated.push(group_chat.to_summary_updates(updates_since));
            }
        }

        let group_chats = GroupChatsUpdates {
            added: group_chats_added,
            updated: group_chats_updated,
            removed: user.group_chats.removed_since(updates_since),
        };

        let mut communities_added = Vec::new();
        let mut communities_updated = Vec::new();
        for community in user.communities.updated_since(updates_since) {
            if community.date_joined > updates_since {
                communities_added.push(community.to_summary());
            } else {
                communities_updated.push(community.to_summary_updates(updates_since));
            }
        }

        let communities = CommunitiesUpdates {
            added: communities_added,
            updated: communities_updated,
            removed: user.communities.removed_since(updates_since),
        };

        // Direct and group chats are pinned in the one list, as in the User canister
        let direct_pinned = user.direct_chats.pinned_chats_if_updated(updates_since);
        let group_pinned = user.group_chats.pinned_chats_if_updated(updates_since);
        let pinned_chats = match (&direct_pinned, &group_pinned) {
            (Some(direct), Some(group)) => Some(sorted_pinned(&merge_maps(direct, group))),
            (Some(direct), None) => Some(sorted_pinned(&merge_maps(direct, &user.group_chats.pinned_chats()))),
            (None, Some(group)) => Some(sorted_pinned(&merge_maps(&user.direct_chats.pinned_chats(), group))),
            (None, None) => None,
        };

        let favourite_chats = FavouriteChatsUpdates {
            chats: user.favourite_chats.chats_if_updated(updates_since),
            pinned: user
                .favourite_chats
                .pinned_if_updated(updates_since)
                .map(|pinned| sorted_pinned(&pinned)),
        };

        // TODO: Everything not filled in below is unchanged or default until the MultiUser
        // canister holds it per user (see `initial_state`)
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
            achievements: user.chit_events.achievements(Some(updates_since)),
            achievements_last_seen: (user.achievements_last_seen > updates_since).then_some(user.achievements_last_seen),
            total_chit_earned: user.chit_events.total_chit_earned(),
            chit_balance: user.chit_events.chit_balance(),
            streak: user.streak.days(now),
            streak_ends: user.streak.ends(),
            max_streak: user.streak.max_streak(),
            streak_insurance: if streak_insurance_updated {
                OptionUpdate::from_update(user.streak.streak_insurance(now))
            } else {
                OptionUpdate::NoChange
            },
            next_daily_claim: user.streak.next_claim(),
            is_unique_person: None,
            wallet_config,
            referrals: Vec::new(),
            message_activity_summary,
            bots_added_or_updated: Vec::new(),
            bots_removed: Vec::new(),
            btc_address: None,
            one_sec_address: None,
            premium_items: None,
            pinned_chats,
        })
    })
}
