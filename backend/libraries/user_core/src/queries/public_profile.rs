use crate::User;
use user_canister::public_profile::PublicProfile;

pub fn public_profile(user: &User) -> PublicProfile {
    PublicProfile {
        username: user.username.value.clone(),
        display_name: user.display_name.value.clone(),
        avatar_id: user.avatar.id(),
        profile_background_id: user.profile_background.id(),
        bio: user.bio.value.clone(),
        is_premium: user.phone_is_verified || user.storage_limit > 0,
        phone_is_verified: user.phone_is_verified,
        created: user.user_created,
    }
}
