use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use types::UserDetails;
use user_index_canister::c2c_lookup_user::{Response::*, *};

#[query(msgpack = true)]
fn c2c_lookup_user(args: Args) -> Response {
    read_state(|state| c2c_lookup_user_impl(args, state))
}

fn c2c_lookup_user_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(user) = state.data.users.get(&args.user_id_or_principal) {
        let now = state.env.now();
        // A suspended account holds no authority while the sanction stands: consumers of
        // these flags (group_index freezes, chat-canister moderator powers) must not honour
        // a suspended moderator/operator
        let suspended = user.suspension_details.is_some();
        let is_platform_moderator = !suspended && state.data.platform_moderators.contains(&user.user_id);
        let is_platform_operator = !suspended && state.data.platform_operators.contains(&user.user_id);
        let is_diamond_member = user.diamond_membership_details.is_active(now);

        Success(UserDetails {
            principal: user.principal,
            user_id: user.user_id,
            username: user.username.clone(),
            is_bot: user.user_type.is_bot(),
            is_platform_moderator,
            is_platform_operator,
            is_diamond_member,
        })
    } else {
        UserNotFound
    }
}
