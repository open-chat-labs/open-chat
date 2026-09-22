use crate::User;
use types::TimestampMillis;
use user_canister::manage_favourite_chats::Args;

// Adds and removes the given favourite chats, returning true if any were added, which earns the
// `FavouritedChat` achievement from the caller.
pub fn manage_favourite_chats(user: &mut User, args: Args, now: TimestampMillis) -> bool {
    let adding = !args.to_add.is_empty();

    for chat in args.to_add {
        user.favourite_chats.add(chat, now);
    }
    for chat in args.to_remove {
        user.favourite_chats.remove(&chat, now);
    }

    adding
}
