use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::UserId;

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Hash)]
pub struct FcmToken(String);

impl From<String> for FcmToken {
    fn from(token: String) -> Self {
        FcmToken(token)
    }
}
impl From<FcmToken> for String {
    fn from(token: FcmToken) -> Self {
        token.0
    }
}
impl AsRef<str> for FcmToken {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

type FcmTokenId = u64;

/// We store FCM tokens in a way that allows us to efficiently check for
/// existence, reduce memoy usage, and get tokens for a specific user.
///
/// We use two properties to track FCM tokens; first one as a full set of
/// reported tokens, and the second to track which tokens are assigned to which
/// user. To avoid duplicating token values and to reduce memory usage, we assign
/// a unique ID for each token. This id is then used to map tokens to users.
#[derive(Serialize, Deserialize, Default, Debug)]
pub struct FcmTokenStore {
    // TODO consider recycling token IDs, perhaps using VecDeque
    latest_token_id: FcmTokenId,

    /// Maps FCM token IDs to the actual FCM token.
    fcm_tokens: HashMap<FcmTokenId, FcmToken>,

    /// Maps user IDs to a set of FCM token IDs.
    fcm_tokens_for_user: HashMap<UserId, HashSet<FcmTokenId>>,
}

impl FcmTokenStore {
    /// Checks if a given FCM token exists!
    pub fn check_token_exists(&self, token: &FcmToken) -> bool {
        self.fcm_tokens.values().any(|t| t == token)
    }

    /// Add a new FCM token, and assign it to a user.
    ///
    /// If the token already exists, it will not be added again - this also
    /// ensures that the user does not have duplicate tokens, or that the same
    /// token is not assigned to multiple users.
    pub fn add_token(&mut self, token: FcmToken, user_id: UserId) -> Result<(), String> {
        if !self.check_token_exists(&token) {
            self.latest_token_id += 1;
            self.fcm_tokens.insert(self.latest_token_id, token.clone());
            self.fcm_tokens_for_user
                .entry(user_id)
                .or_default()
                .insert(self.latest_token_id);

            Ok(())
        } else {
            Err("Token already exists".to_string())
        }
    }

    /// Remove a token from the store. We remove tokens when the Firebase
    /// request to push notification with this token fails, which means that
    /// the token is no longer valid or the user has uninstalled the app. We
    /// should also have the user id available at that point.
    ///
    /// If the token exists, it will remove the mapping and return the user ID.
    /// If the token does not exist, it will return None.
    pub fn remove_token(&mut self, token: &FcmToken, user_id: &UserId) -> Result<(), String> {
        // Find the token ID associated with the given FCM token
        self.fcm_tokens
            .iter()
            .find(|(_, t)| *t == token)
            .map(|(id, _)| *id)
            .map_or_else(
                || Err("Token not found".to_string()),
                |token_id| {
                    // Remove the token ID from the user's set of tokens
                    if let Some(tokens) = self.fcm_tokens_for_user.get_mut(user_id) {
                        // Make sure token is associated with the user!
                        if !tokens.contains(&token_id) {
                            return Err("Token is not associated with user".to_string());
                        }

                        // Remove the token ID from the user's set
                        tokens.remove(&token_id);

                        // If the user has no more tokens, remove the user entry.
                        // This is a micro optimization to keep the map clean.
                        if tokens.is_empty() {
                            self.fcm_tokens_for_user.remove(user_id);
                        }

                        // Finally, remove the token from the fcm_tokens map
                        self.fcm_tokens.remove(&token_id);

                        Ok(())
                    } else {
                        Err("No tokens associated with user".to_string())
                    }
                },
            )
    }

    /// Get all FCM tokens associated with a specific user.
    pub fn get_tokens_for_user(&self, user_id: &UserId) -> Option<Vec<&FcmToken>> {
        self.fcm_tokens_for_user
            .get(user_id)
            .map(|token_ids| token_ids.iter().filter_map(|id| self.fcm_tokens.get(id)).collect::<Vec<_>>())
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
        let token1 = FcmToken::from("token1".to_string());
        let token2 = FcmToken::from("token2".to_string());
        let token3 = FcmToken::from("token3".to_string());

        assert_eq!(store.add_token(token1.clone(), user_id1), Ok(()));
        assert_eq!(store.add_token(token2.clone(), user_id1), Ok(()));
        assert_eq!(
            store.add_token(token1.clone(), user_id2),
            Err("Token already exists".to_string())
        );

        assert!(store.check_token_exists(&token1));
        assert!(store.check_token_exists(&token2));
        assert!(!store.check_token_exists(&token3));

        let store_tokens = store.get_tokens_for_user(&user_id1).expect("User should have tokens");
        assert_eq!(store_tokens.len(), 2);
        assert!(store_tokens.contains(&&token1));
        assert!(store_tokens.contains(&&token2));
        assert_eq!(store.get_tokens_for_user(&user_id2), None);

        assert_eq!(
            store.remove_token(&token1, &user_id2),
            Err("No tokens associated with user".to_string())
        );

        assert_eq!(store.remove_token(&token1, &user_id1), Ok(()));
        assert_eq!(store.remove_token(&token1, &user_id1), Err("Token not found".to_string()));
    }
}
