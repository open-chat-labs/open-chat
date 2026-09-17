use crate::guards::caller_is_owner;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_canister::initial_state::{Response::*, *};
use user_canister::{MessageActivitySummary, WalletConfig};

#[query(guard = "caller_is_owner", msgpack = true)]
fn initial_state(_args: Args) -> Response {
    read_state(initial_state_impl)
}

fn initial_state_impl(state: &RuntimeState) -> Response {
    let now = state.env.now();
    let cores = &state.data.direct_chat_cores;

    state.with_caller_user(|my_index, user| {
        let my_user_id = state.user_id(my_index);

        let direct_chats = DirectChatsInitial {
            summaries: user
                .direct_chats
                .iter()
                .map(|entry| cores.with_chat(entry, |chat| chat.to_summary(my_user_id)))
                .collect(),
        };

        // TODO: Everything below the direct chats is empty or default until the MultiUser
        // canister holds it per user: groups, communities and favourites, blocked users, the
        // avatar, the pin number, chit and achievements, the streak, the wallet config, referrals,
        // the message activity feed, bots, the BTC and 1sec addresses and premium items
        Success(SuccessResult {
            timestamp: now,
            direct_chats,
            group_chats: GroupChatsInitial { summaries: Vec::new() },
            favourite_chats: FavouriteChatsInitial {
                chats: Vec::new(),
                pinned: Vec::new(),
            },
            communities: CommunitiesInitial { summaries: Vec::new() },
            avatar_id: None,
            blocked_users: Vec::new(),
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
            wallet_config: WalletConfig::default(),
            referrals: Vec::new(),
            message_activity_summary: MessageActivitySummary {
                read_up_to: 0,
                latest_event_timestamp: 0,
                unread_count: 0,
            },
            bots: Vec::new(),
            btc_address: None,
            one_sec_address: None,
            premium_items: Vec::new(),
            pinned_chats: user.direct_chats.pinned_chats(),
        })
    })
}
