use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use types::{OptionUpdate, TimestampMillis};
use user_canister::updates::{Response::*, *};
use user_state::sorted_pinned;

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

        let has_any_updates = username.is_some()
            || display_name.has_update()
            || avatar_id.has_update()
            || blocked_users.is_some()
            || pin_number_updated
            || suspended.is_some()
            || wallet_config.is_some()
            || user.favourite_chats.any_updated(updates_since)
            || user.direct_chats.any_updated(updates_since);

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
            group_chats: GroupChatsUpdates::default(),
            favourite_chats,
            communities: CommunitiesUpdates::default(),
            avatar_id,
            blocked_users,
            suspended,
            pin_number_settings,
            achievements: Vec::new(),
            achievements_last_seen: None,
            total_chit_earned: 0,
            chit_balance: 0,
            streak: 0,
            streak_ends: 0,
            max_streak: 0,
            streak_insurance: OptionUpdate::NoChange,
            next_daily_claim: 0,
            is_unique_person: None,
            wallet_config,
            referrals: Vec::new(),
            message_activity_summary: None,
            bots_added_or_updated: Vec::new(),
            bots_removed: Vec::new(),
            btc_address: None,
            one_sec_address: None,
            premium_items: None,
            pinned_chats: user
                .direct_chats
                .pinned_chats_if_updated(updates_since)
                .map(|pinned| sorted_pinned(&pinned)),
        })
    })
}
