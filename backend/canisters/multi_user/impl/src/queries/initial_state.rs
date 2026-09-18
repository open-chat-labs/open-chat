use crate::guards::caller_is_owner;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_canister::initial_state::{Response::*, *};
use user_state::sorted_pinned;

#[query(guard = "caller_is_owner", msgpack = true)]
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

        // TODO: Everything below which is empty or default stays so until the MultiUser canister
        // holds it per user: groups and communities, the pin number, chit and achievements, the
        // streak, referrals, bots, the BTC and 1sec addresses and
        // premium items
        Success(SuccessResult {
            timestamp: now,
            direct_chats,
            group_chats: GroupChatsInitial { summaries: Vec::new() },
            favourite_chats,
            communities: CommunitiesInitial { summaries: Vec::new() },
            avatar_id: user.avatar.id(),
            blocked_users: user.blocked_users.all(),
            suspended: user.suspended.value,
            pin_number_settings: None,
            local_user_index_canister_id: state.data.local_user_index_canister_id,
            achievements: Vec::new(),
            achievements_last_seen: 0,
            total_chit_earned: 0,
            chit_balance: 0,
            streak: 0,
            streak_ends: 0,
            max_streak: 0,
            streak_insurance: None,
            next_daily_claim: 0,
            is_unique_person: false,
            wallet_config: user.wallet_config.value.clone(),
            referrals: Vec::new(),
            message_activity_summary: user.message_activity_events.summary(),
            bots: Vec::new(),
            btc_address: None,
            one_sec_address: None,
            premium_items: Vec::new(),
            // Only direct and group chats are merged in here; pinned favourites are listed above
            pinned_chats: sorted_pinned(&user.direct_chats.pinned_chats()),
        })
    })
}
