use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use types::UserId;
use user_canister::initial_state::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn initial_state(_args: Args) -> Response {
    read_state(initial_state_impl)
}

fn initial_state_impl(state: &RuntimeState) -> Response {
    let now = state.env.now();
    let my_user_id: UserId = state.env.canister_id().into();
    let avatar_id = state.data.avatar.value.as_ref().map(|a| a.id);
    let blocked_users = state.data.blocked_users.value.iter().copied().collect();

    let direct_chats = DirectChatsInitial {
        summaries: state.data.direct_chats.iter().map(|d| d.to_summary(my_user_id)).collect(),
        pinned: state.data.direct_chats.pinned().to_vec(),
    };

    let group_chats = GroupChatsInitial {
        summaries: state.data.group_chats.iter().map(|g| g.to_summary()).collect(),
        pinned: state.data.group_chats.pinned().to_vec(),
        cached: None,
    };

    let communities = CommunitiesInitial {
        summaries: state.data.communities.iter().map(|c| c.to_summary()).collect(),
    };

    let favourite_chats = FavouriteChatsInitial {
        chats: state.data.favourite_chats.chats().to_vec(),
        pinned: state.data.favourite_chats.pinned().to_vec(),
    };

    Success(SuccessResult {
        timestamp: now,
        direct_chats,
        group_chats,
        favourite_chats,
        communities,
        avatar_id,
        blocked_users,
        suspended: state.data.suspended.value,
        local_user_index_canister_id: state.data.local_user_index_canister_id,
    })
}
