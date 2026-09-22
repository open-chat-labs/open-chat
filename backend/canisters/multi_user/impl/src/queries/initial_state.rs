use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_canister::initial_state::{Response::*, *};
use user_state::{merge_maps, sorted_pinned};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn initial_state(_args: Args) -> Response {
    read_state(initial_state_impl)
}

fn initial_state_impl(state: &RuntimeState) -> Response {
    let now = state.env.now();

    state.with_caller_user(|my_index, user| {
        let my_user_id = state.user_id(my_index);

        let direct_chats = DirectChatsInitial {
            summaries: user.direct_chats.iter().map(|chat| chat.to_summary(my_user_id)).collect(),
        };

        let favourite_chats = FavouriteChatsInitial {
            chats: user.favourite_chats.chats().to_vec(),
            pinned: sorted_pinned(user.favourite_chats.pinned()),
        };

        let group_chats = GroupChatsInitial {
            summaries: user.group_chats.iter().map(|g| g.to_summary()).collect(),
        };

        let communities = CommunitiesInitial {
            summaries: user.communities.iter().map(|c| c.to_summary()).collect(),
        };

        // TODO: Report the user's bots once the MultiUser canister installs them
        Success(SuccessResult {
            timestamp: now,
            direct_chats,
            group_chats,
            favourite_chats,
            communities,
            avatar_id: user.avatar.id(),
            blocked_users: user.blocked_users.all(),
            suspended: user.suspended.value,
            pin_number_settings: user.pin_number.enabled().then(|| user.pin_number.settings(now)),
            local_user_index_canister_id: state.data.local_user_index_canister_id,
            achievements: user.chit_events.achievements(None),
            achievements_last_seen: user.achievements_last_seen,
            total_chit_earned: user.chit_events.total_chit_earned(),
            chit_balance: user.chit_events.chit_balance(),
            streak: user.streak.days(now),
            streak_ends: user.streak.ends(),
            max_streak: user.streak.max_streak(),
            streak_insurance: user.streak.streak_insurance(now),
            next_daily_claim: user.streak.next_claim(),
            is_unique_person: user.unique_person_proof.is_some(),
            wallet_config: user.wallet_config.value.clone(),
            referrals: user.referrals.list(),
            message_activity_summary: user.message_activity_events.summary(),
            bots: Vec::new(),
            btc_address: user.btc_address.as_ref().map(|a| a.value.clone()),
            one_sec_address: user.one_sec_address.as_ref().map(|a| a.value.clone()),
            premium_items: user.premium_items.item_ids(),
            // Only direct and group chats are merged in here; pinned favourites are listed above
            pinned_chats: sorted_pinned(&merge_maps(
                &user.direct_chats.pinned_chats(),
                &user.group_chats.pinned_chats(),
            )),
        })
    })
}
