use types::{C2CError, CanisterId, UserId};

// What has become of a user whose canister couldn't be called as a User canister when sending them
// events
pub enum EventRecipient {
    // They have been migrated to a MultiUser canister, and have this new id
    Migrated(UserId),
    // They are no longer a user, having deleted their account, or never had a User canister, being
    // a bot, so the events can never be delivered
    Gone,
    // They are still a user under this id, eg. one whose migration hasn't yet been heard of
    User,
}

// Looks the user up from the LocalUserIndex, and only if it doesn't know of them, from the UserIndex.
// A LocalUserIndex hears of each new user and migration from the UserIndex in its own time, so its
// not knowing of a user doesn't on its own mean they are gone, whereas the UserIndex has every user.
//
// Each index is asked about the user before their migration, since a migrated user's old id is
// dropped at the same time as their migration is recorded, so a user who is missing because they
// have just been migrated is then found to have been.
pub async fn lookup_event_recipient(
    user_id: UserId,
    local_user_index_canister_id: CanisterId,
    user_index_canister_id: CanisterId,
) -> Result<EventRecipient, C2CError> {
    let user = local_user_index_canister_c2c_client::lookup_user(user_id.as_principal(), local_user_index_canister_id).await?;
    if let Some(new_user_id) =
        local_user_index_canister_c2c_client::lookup_migrated_user_id(user_id, local_user_index_canister_id).await?
    {
        return Ok(EventRecipient::Migrated(new_user_id));
    }
    if let Some(user) = user {
        return Ok(if user.user_type.is_bot() { EventRecipient::Gone } else { EventRecipient::User });
    }

    let user = user_index_canister_c2c_client::lookup_user(user_id.as_principal(), user_index_canister_id).await?;
    if let Some(new_user_id) = user_index_canister_c2c_client::lookup_migrated_user_id(user_id, user_index_canister_id).await? {
        return Ok(EventRecipient::Migrated(new_user_id));
    }
    Ok(match user {
        Some(user) if !user.is_bot => EventRecipient::User,
        _ => EventRecipient::Gone,
    })
}
