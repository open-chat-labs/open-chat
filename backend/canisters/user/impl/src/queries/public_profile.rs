use crate::read_state;
use ic_cdk_macros::query;
use user_canister::public_profile::{Response::*, *};

#[query]
fn public_profile(_args: Args) -> Response {
    read_state(|state| {
        Success(PublicProfile {
            username: state.data.username.clone(),
            bio: state.data.bio.clone(),
            is_premium: state.data.phone_is_verified || state.data.storage_limit > 0,
            phone_is_verified: state.data.phone_is_verified,
        })
    })
}
