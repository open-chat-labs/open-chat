use crate::guards::caller_is_owner;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use types::{InstalledBotDetails, UserId};
use user_canister::initial_state::{Response::*, *};
use user_state::{merge_maps, sorted_pinned};

#[query(guard = "caller_is_owner", msgpack = true)]
fn initial_state(_args: Args) -> Response {
    read_state(initial_state_impl)
}

fn initial_state_impl(state: &RuntimeState) -> Response {
    let now = state.env.now();
    let my_user_id: UserId = state.env.canister_id().into();
    let avatar_id = state.data.user.avatar.id();
    let blocked_users = state.data.user.blocked_users.all().into_iter().collect();
    let merged_pinned = sorted_pinned(&merge_maps(
        &state.data.user.direct_chats.pinned_chats(),
        &state.data.user.group_chats.pinned_chats(),
    ));

    let direct_chats = DirectChatsInitial {
        summaries: state
            .data
            .user
            .direct_chats
            .iter()
            .map(|d| d.to_summary(my_user_id))
            .collect(),
    };

    let group_chats = GroupChatsInitial {
        summaries: state.data.user.group_chats.iter().map(|g| g.to_summary()).collect(),
    };

    let communities = CommunitiesInitial {
        summaries: state.data.user.communities.iter().map(|c| c.to_summary()).collect(),
    };

    let favourite_chats = FavouriteChatsInitial {
        chats: state.data.user.favourite_chats.chats().to_vec(),
        pinned: sorted_pinned(state.data.user.favourite_chats.pinned()),
    };

    let bots = state
        .data
        .bots
        .iter()
        .map(|(user_id, bot)| InstalledBotDetails {
            user_id: *user_id,
            added_by: bot.added_by,
            permissions: bot.permissions.clone(),
            autonomous_permissions: bot.autonomous_permissions.clone(),
        })
        .collect();

    Success(SuccessResult {
        timestamp: now,
        direct_chats,
        group_chats,
        favourite_chats,
        communities,
        avatar_id,
        blocked_users,
        suspended: state.data.user.suspended.value,
        pin_number_settings: state
            .data
            .user
            .pin_number
            .enabled()
            .then(|| state.data.user.pin_number.settings(now)),
        local_user_index_canister_id: state.data.local_user_index_canister_id,
        achievements: state.data.user.chit_events.achievements(None),
        achievements_last_seen: state.data.user.achievements_last_seen,
        total_chit_earned: state.data.user.chit_events.total_chit_earned(),
        chit_balance: state.data.user.chit_events.chit_balance(),
        streak: state.data.user.streak.days(now),
        streak_ends: state.data.user.streak.ends(),
        max_streak: state.data.user.streak.max_streak(),
        streak_insurance: state.data.user.streak.streak_insurance(now),
        next_daily_claim: state.data.user.streak.next_claim(),
        is_unique_person: state.data.user.unique_person_proof.is_some(),
        wallet_config: state.data.user.wallet_config.value.clone(),
        referrals: state.data.user.referrals.list(),
        message_activity_summary: state.data.user.message_activity_events.summary(),
        bots,
        btc_address: state.data.btc_address.as_ref().map(|a| a.value.clone()),
        one_sec_address: state.data.one_sec_address.as_ref().map(|a| a.value.clone()),
        premium_items: state.data.premium_items.item_ids(),
        pinned_chats: merged_pinned,
    })
}
