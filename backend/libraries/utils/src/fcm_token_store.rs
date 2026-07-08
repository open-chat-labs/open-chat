use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use types::{FcmToken, UserId};

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct FcmTokenStore {
    // User tokens are stored in a BTreeSet to ensure uniqueness!
    fcm_user_tokens: BTreeSet<(UserId, FcmToken)>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum FcmTokenAddResult {
    /// The token was not in the store and is now assigned to the user.
    Added,
    /// The user already owns this token; nothing changed.
    AlreadyOwned,
    /// The token was assigned to another user (e.g. a previous account on the
    /// same device) and has been re-assigned to the caller. Holds the previous
    /// owner so callers can propagate the removal.
    Reassigned(UserId),
}

impl FcmTokenStore {
    /// Checks if a given FCM token is contained within the store!
    pub fn contains(&self, token: &FcmToken) -> bool {
        self.fcm_user_tokens.iter().any(|(_, t)| t == token)
    }

    /// Add an FCM token, and assign it to a user.
    ///
    /// A device token identifies an app install, not an account, so the last
    /// user to register it wins: if the token is currently assigned to a
    /// different user (a previous account on the same device that didn't
    /// cleanly sign out), the old mapping is replaced. This keeps a token from
    /// pushing one account's notifications to a device now used by another,
    /// and ensures the new account actually receives pushes.
    pub fn add(&mut self, user_id: UserId, token: FcmToken) -> FcmTokenAddResult {
        if self.fcm_user_tokens.contains(&(user_id, token.clone())) {
            return FcmTokenAddResult::AlreadyOwned;
        }

        let previous_owner = self.fcm_user_tokens.iter().find(|(_, t)| t == &token).map(|(user, _)| *user);

        if let Some(previous_owner) = previous_owner {
            self.fcm_user_tokens.remove(&(previous_owner, token.clone()));
            self.fcm_user_tokens.insert((user_id, token));
            FcmTokenAddResult::Reassigned(previous_owner)
        } else {
            self.fcm_user_tokens.insert((user_id, token));
            FcmTokenAddResult::Added
        }
    }

    /// Remove a token from the store. We remove tokens when the Firebase
    /// request to push notification with the token fails. This means that
    /// the token is no longer valid or the user has uninstalled the app.
    ///
    /// If the user and token combo exists, it will remove the mapping, and we
    /// confirm that with the OK result. If the token is not associated
    /// with the user, remove operation returns false, and we return an error.
    pub fn remove(&mut self, user_id: &UserId, token: &FcmToken) -> Result<(), String> {
        if self.fcm_user_tokens.remove(&(*user_id, token.clone())) {
            Ok(())
        } else {
            Err("Token is not associated with current user".to_string())
        }
    }

    /// Returns all FCM tokens for a given user. This is a fast lookup
    /// leveraging the BTreeSet structure.
    pub fn get_for_user(&self, user_id: &UserId) -> Vec<&FcmToken> {
        self.fcm_user_tokens
            .range((*user_id, FcmToken(String::default()))..)
            .take_while(|(u, _)| u == user_id)
            .map(|(_, token)| token)
            .collect()
    }

    pub fn len(&self) -> usize {
        self.fcm_user_tokens.len()
    }

    pub fn is_empty(&self) -> bool {
        self.fcm_user_tokens.is_empty()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use types::CanisterId;

    #[test]
    fn test_fcm_token_store() {
        let mut store = FcmTokenStore::default();

        let user_id1 = UserId::new(CanisterId::from_text("3skqk-iqaaa-aaaaf-aaa3q-cai").expect("Invalid principal"));
        let user_id2 = UserId::new(CanisterId::from_text("hnv5y-siaaa-aaaaf-aacza-cai").expect("Invalid principal"));
        let user_id3 = UserId::new(CanisterId::from_text("2yfsq-kaaaa-aaaaf-aaa4q-cai").expect("Invalid principal"));

        let token1 = FcmToken::from("token1".to_string());
        let token2 = FcmToken::from("token2".to_string());
        let token3 = FcmToken::from("token3".to_string());
        let token4 = FcmToken::from("token4".to_string());

        // Assert tokens can be added
        assert_eq!(store.add(user_id1, token1.clone()), FcmTokenAddResult::Added);
        assert_eq!(store.add(user_id3, token4.clone()), FcmTokenAddResult::Added);
        assert_eq!(store.add(user_id1, token2.clone()), FcmTokenAddResult::Added);

        // Re-adding a token the user already owns is a no-op
        assert_eq!(store.add(user_id1, token1.clone()), FcmTokenAddResult::AlreadyOwned);

        // Adding a token owned by a different user re-assigns it (last login wins)
        assert_eq!(store.add(user_id2, token4.clone()), FcmTokenAddResult::Reassigned(user_id3));
        assert!(store.get_for_user(&user_id3).is_empty());
        assert_eq!(store.get_for_user(&user_id2), vec![&token4]);
        assert_eq!(store.len(), 3);

        // ...and re-assigning it back works the same way
        assert_eq!(store.add(user_id3, token4.clone()), FcmTokenAddResult::Reassigned(user_id2));

        // Assert that we can check if the store contains a token
        assert!(store.contains(&token1));
        assert!(store.contains(&token2));
        assert!(!store.contains(&token3));

        // Assert that retrieveing tokens for users works correctly
        let store_tokens = store.get_for_user(&user_id1);
        assert_eq!(store_tokens.len(), 2);
        assert!(store_tokens.contains(&&token1));
        assert!(store_tokens.contains(&&token2));

        // Also, if a user has no tokens, we should get an empty list
        let store_tokens = store.get_for_user(&user_id2);
        assert!(store_tokens.is_empty());

        // Tokens cannot be removed if they are not associated with the current
        // user, and we should get an error.
        assert_eq!(
            store.remove(&user_id2, &token1),
            Err("Token is not associated with current user".to_string())
        );

        // Assert that we can remove tokens correctly, and if we try it again,
        // we should get an error.
        assert_eq!(store.remove(&user_id1, &token1), Ok(()));
        assert_eq!(
            store.remove(&user_id1, &token1),
            Err("Token is not associated with current user".to_string())
        );
    }
}
