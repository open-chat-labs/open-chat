use candid::Principal;
use direct_chat::DirectChats;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use types::{TimestampMillis, Timestamped, UserId};
use user_canister::{MessageActivityEvent, WalletConfig};
use user_state::{BlockedUsers, Contacts, FavouriteChats, MessageActivityEvents, ProfileDocument};

// The state of a single user within the canister. This mirrors the per-user fields of the User
// canister's `Data`, using the same names and types, so that the logic of each endpoint can be
// shared and a user could later be moved between the two kinds of canister.
//
// Any stable memory map entries a user holds are keyed under that user's index, so a `User` must
// only be accessed within its key scope, which `Users` takes care of.
#[derive(Serialize, Deserialize)]
pub struct User {
    pub principal: Principal,
    pub username: Timestamped<String>,
    pub display_name: Timestamped<Option<String>>,
    pub bio: Timestamped<String>,
    pub avatar: ProfileDocument,
    pub profile_background: ProfileDocument,
    pub user_created: TimestampMillis,
    pub suspended: Timestamped<bool>,
    pub referred_by: Option<UserId>,
    pub direct_chats: DirectChats,
    pub favourite_chats: FavouriteChats,
    pub blocked_users: BlockedUsers,
    pub contacts: Contacts,
    pub wallet_config: Timestamped<WalletConfig>,
    #[serde(default)]
    pub message_activity_events: MessageActivityEvents,
    // When the earliest event due to expire in any of the user's direct chats expires, which is
    // when the job to remove the user's expired events next runs
    #[serde(default)]
    pub next_event_expiry: Option<TimestampMillis>,
}

impl User {
    pub fn new(principal: Principal, username: String, referred_by: Option<UserId>, now: TimestampMillis) -> User {
        User {
            principal,
            username: Timestamped::new(username, now),
            display_name: Timestamped::default(),
            bio: Timestamped::new(String::new(), now),
            avatar: ProfileDocument::default(),
            profile_background: ProfileDocument::default(),
            user_created: now,
            suspended: Timestamped::default(),
            referred_by,
            direct_chats: DirectChats::default(),
            favourite_chats: FavouriteChats::default(),
            blocked_users: BlockedUsers::default(),
            contacts: Contacts::default(),
            wallet_config: Timestamped::default(),
            message_activity_events: MessageActivityEvents::default(),
            next_event_expiry: None,
        }
    }

    pub fn verify_not_suspended(&self) -> Result<(), OCErrorCode> {
        if self.suspended.value { Err(OCErrorCode::InitiatorSuspended) } else { Ok(()) }
    }

    // Blocks the user with the given id, if they weren't already blocked
    pub fn block_user(&mut self, user_id: UserId, now: TimestampMillis) {
        // TODO: Tell the LocalUserIndex (`UserBlocked`), as the User canister does, once the
        // MultiUser canister has a queue of events for it
        self.blocked_users.block(user_id, now);
    }

    // Adds an event to the user's message activity feed, unless it was caused by a user they have
    // blocked
    pub fn push_message_activity(&mut self, event: MessageActivityEvent, now: TimestampMillis) {
        if event.user_id.is_none_or(|user_id| !self.blocked_users.contains(&user_id)) {
            self.message_activity_events.push(event, now);
        }
    }

    pub fn unblock_user(&mut self, user_id: UserId, now: TimestampMillis) {
        // TODO: Tell the LocalUserIndex (`UserUnblocked`), as above
        self.blocked_users.unblock(user_id, now);
    }
}
