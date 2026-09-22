use crate::read_state;
use canister_api_macros::query;
use user_canister::public_profile::{Response::*, *};

#[query(msgpack = true)]
fn public_profile(_args: Args) -> Response {
    read_state(|state| {
        Success(PublicProfile {
            username: state.data.user.username.value.clone(),
            display_name: state.data.user.display_name.value.clone(),
            avatar_id: state.data.user.avatar.id(),
            profile_background_id: state.data.user.profile_background.id(),
            bio: state.data.user.bio.value.clone(),
            is_premium: state.data.user.phone_is_verified || state.data.user.storage_limit > 0,
            phone_is_verified: state.data.user.phone_is_verified,
            created: state.data.user.user_created,
        })
    })
}
