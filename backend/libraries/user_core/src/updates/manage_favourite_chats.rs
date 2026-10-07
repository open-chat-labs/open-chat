use crate::User;
use constants::MAX_FAVOURITE_CHATS;
use oc_error_codes::OCErrorCode;
use std::collections::HashSet;
use types::{OCResult, TimestampMillis};
use user_canister::manage_favourite_chats::Args;

// Adds and removes the given favourite chats, returning true if any were added, which earns the
// `FavouritedChat` achievement from the caller. Nothing is changed if new favourites would leave the
// user with more than `MAX_FAVOURITE_CHATS`, but a user already over the limit can still remove
// favourites.
pub fn manage_favourite_chats(user: &mut User, args: Args, now: TimestampMillis) -> OCResult<bool> {
    let adding = !args.to_add.is_empty();

    // The chats are added before any are removed, so a chat both added and removed ends up removed
    let new: HashSet<_> = args.to_add.iter().filter(|c| !user.favourite_chats.contains(c)).collect();
    if !new.is_empty() {
        let removed: HashSet<_> = args
            .to_remove
            .iter()
            .filter(|c| user.favourite_chats.contains(c) || new.contains(c))
            .collect();
        if user.favourite_chats.len() + new.len() - removed.len() > MAX_FAVOURITE_CHATS {
            return Err(OCErrorCode::LimitReached.with_message(MAX_FAVOURITE_CHATS));
        }
    }

    for chat in args.to_add {
        user.favourite_chats.add_without_limit(chat, now);
    }
    for chat in args.to_remove {
        user.favourite_chats.remove(&chat, now);
    }

    Ok(adding)
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use types::Chat;

    #[test]
    fn nothing_is_changed_if_the_limit_would_be_exceeded() {
        let mut user = User::new(Principal::from_slice(&[1]), "user".to_string(), None, 0);
        let chat = |i: u32| Chat::Group(Principal::from_slice(&i.to_be_bytes()).into());
        let args = |to_add: Vec<Chat>, to_remove: Vec<Chat>| Args { to_add, to_remove };

        assert!(
            manage_favourite_chats(
                &mut user,
                args((0..MAX_FAVOURITE_CHATS as u32).map(chat).collect(), Vec::new()),
                1
            )
            .unwrap()
        );

        let error = manage_favourite_chats(&mut user, args(vec![chat(1000), chat(1001)], vec![chat(0)]), 2).unwrap_err();
        assert!(error.matches_code(OCErrorCode::LimitReached), "{error:?}");
        assert!(user.favourite_chats.contains(&chat(0)));
        assert!(!user.favourite_chats.contains(&chat(1000)));

        // Re-adding chats which are already favourites is fine, as is adding one in place of one removed
        assert!(manage_favourite_chats(&mut user, args(vec![chat(0)], Vec::new()), 3).unwrap());
        assert!(manage_favourite_chats(&mut user, args(vec![chat(1000)], vec![chat(0)]), 4).unwrap());
        assert!(user.favourite_chats.contains(&chat(1000)));
        assert!(!user.favourite_chats.contains(&chat(0)));
        assert_eq!(user.favourite_chats.len(), MAX_FAVOURITE_CHATS);
    }

    #[test]
    fn a_user_over_the_limit_can_still_remove_favourites() {
        let mut user = User::new(Principal::from_slice(&[1]), "user".to_string(), None, 0);
        let chat = |i: u32| Chat::Group(Principal::from_slice(&i.to_be_bytes()).into());
        // Favourites added before the limit was introduced
        for i in 0..MAX_FAVOURITE_CHATS as u32 + 5 {
            user.favourite_chats.add_without_limit(chat(i), 1);
        }

        let removed = manage_favourite_chats(
            &mut user,
            Args {
                to_add: Vec::new(),
                to_remove: vec![chat(0)],
            },
            2,
        );
        assert!(!removed.unwrap());
        assert_eq!(user.favourite_chats.len(), MAX_FAVOURITE_CHATS + 4);

        // But can't add any until they're back under it
        let error = manage_favourite_chats(
            &mut user,
            Args {
                to_add: vec![chat(0)],
                to_remove: Vec::new(),
            },
            3,
        )
        .unwrap_err();
        assert!(error.matches_code(OCErrorCode::LimitReached), "{error:?}");
    }
}
