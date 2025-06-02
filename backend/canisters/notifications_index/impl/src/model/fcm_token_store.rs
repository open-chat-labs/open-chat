use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use types::{FcmToken, UserId};

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct FcmTokenStore {
    // User tokens are stored in a BTreeSet to ensure uniqueness!
    fcm_user_tokens: BTreeSet<(UserId, FcmToken)>,
}

impl FcmTokenStore {
    /// Checks if a given FCM token exists!
    pub fn check_token_exists(&self, token: &FcmToken) -> bool {
        self.fcm_user_tokens.iter().any(|(_, t)| t == token)
    }

    /// Add a new FCM token, and assign it to a user.
    ///
    /// If the token already exists, it will not be added again - this also
    /// ensures that the user does not have duplicate tokens, or that the same
    /// token is not assigned to multiple users.
    pub fn add_token(&mut self, user_id: UserId, token: FcmToken) -> Result<(), String> {
        if !self.check_token_exists(&token) {
            self.fcm_user_tokens.insert((user_id, token.clone()));
            Ok(())
        } else {
            Err("Token already exists".to_string())
        }
    }

    /// Remove a token from the store. We remove tokens when the Firebase
    /// request to push notification with the token fails. This means that
    /// the token is no longer valid or the user has uninstalled the app.
    ///
    /// If the user and token combo exists, it will remove the mapping, and we
    /// confirm that with the OK result. If the token is not associated
    /// with the user, remove operation returns false, and we return an error.
    pub fn remove_token(&mut self, user_id: &UserId, token: &FcmToken) -> Result<(), String> {
        if self.fcm_user_tokens.remove(&(*user_id, token.clone())) {
            Ok(())
        } else {
            Err("Token is not associated with current user".to_string())
        }
    }

    /// Returns all FCM tokens for a given user. This is a fast lookup
    /// leveraging the BTreeSet structure.
    pub fn get_tokens_for_user(&self, user_id: &UserId) -> Vec<&FcmToken> {
        self.fcm_user_tokens
            .range((*user_id, FcmToken(String::default()))..)
            .take_while(|(u, _)| u == user_id)
            .map(|(_, token)| token)
            .collect()
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
        assert_eq!(store.add_token(user_id1, token1.clone()), Ok(()));
        assert_eq!(store.add_token(user_id3, token4.clone()), Ok(()));
        assert_eq!(store.add_token(user_id1, token2.clone()), Ok(()));

        // Assert that adding the same token for a different user fails
        assert_eq!(
            store.add_token(user_id2, token1.clone()),
            Err("Token already exists".to_string())
        );

        // Assert that we can check if a token exists
        assert!(store.check_token_exists(&token1));
        assert!(store.check_token_exists(&token2));
        assert!(!store.check_token_exists(&token3));

        // Assert that retrieveing tokens for users works correctly
        let store_tokens = store.get_tokens_for_user(&user_id1);
        assert_eq!(store_tokens.len(), 2);
        assert!(store_tokens.contains(&&token1));
        assert!(store_tokens.contains(&&token2));

        // Also, if a user has no tokens, we should get an empty list
        let store_tokens = store.get_tokens_for_user(&user_id2);
        assert!(store_tokens.is_empty());

        // Tokens cannot be removed if they are not associated with the current
        // user, and we should get an error.
        assert_eq!(
            store.remove_token(&user_id2, &token1),
            Err("Token is not associated with current user".to_string())
        );

        // Assert that we can remove tokens correctly, and if we try it again,
        // we should get an error.
        assert_eq!(store.remove_token(&user_id1, &token1), Ok(()));
        assert_eq!(
            store.remove_token(&user_id1, &token1),
            Err("Token is not associated with current user".to_string())
        );
    }
}
