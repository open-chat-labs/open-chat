use crate::domain::user_notifications_status::UserNotificationsStatusMap;
use ic_cdk::export::candid::CandidType;
use ic_cdk_macros::*;
use serde::Deserialize;
use shared::storage::StableState;
use shared::storage;
use crate::domain::blob_storage::BlobStorage;
use crate::domain::chat_list::{ChatList, ChatListState};
use crate::domain::blocked_users::BlockedUsers;

#[pre_upgrade]
fn pre_upgrade() {
    let to_save = StableStateOuter {
        chats: storage::take_from_storage(),
        blobs: storage::take_from_storage(),
        blocked_users: storage::take_from_storage(),
        user_notifications_status: storage::take_from_storage(),
    };
    storage::stable_save(to_save);
}

#[post_upgrade]
fn post_upgrade() {
    let saved: StableStateOuter = storage::stable_restore();

    storage::put_in_storage(saved.chats);
    storage::put_in_storage(saved.blobs);
    storage::put_in_storage(saved.blocked_users);
    storage::put_in_storage(saved.user_notifications_status);
}

#[derive(Default)]
struct StableStateOuter {
    chats: ChatList,
    blobs: BlobStorage,
    blocked_users: BlockedUsers,
    user_notifications_status: UserNotificationsStatusMap,
}

#[derive(CandidType, Deserialize)]
struct StableStateInner {
    chats: ChatListState,
    blobs: BlobStorage,
    blocked_users: BlockedUsers,
    user_notifications_status: UserNotificationsStatusMap,
}

impl StableState for StableStateOuter {
    type State = StableStateInner;

    fn drain(self) -> Self::State {
        StableStateInner {
            chats: self.chats.drain(),
            blobs: self.blobs,
            blocked_users: self.blocked_users,
            user_notifications_status: self.user_notifications_status,
        }
    }

    fn fill(source: Self::State) -> Self {
        StableStateOuter {
            chats: ChatList::fill(source.chats),
            blobs: source.blobs,
            blocked_users: source.blocked_users,
            user_notifications_status: source.user_notifications_status,
        }
    }
}
