use ic_cdk::export::candid::CandidType;
use ic_cdk_macros::*;
use serde::Deserialize;
use shared::storage::StableState;
use shared::storage;
use crate::domain::blob_storage::BlobStorage;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::{ChatStableState, ChatStableStatePrevious};

#[pre_upgrade]
fn pre_upgrade() {
    let to_save = StableStateOuter {
        chats: storage::take_from_storage(),
        blobs: storage::take_from_storage()
    };
    storage::stable_save(to_save);
}

#[post_upgrade]
fn post_upgrade() {
    let saved: StableStateOuterPrevious = storage::stable_restore();

    storage::put_in_storage(saved.chats);
    storage::put_in_storage(saved.blobs);
}

#[derive(Default)]
struct StableStateOuter {
    chats: ChatList,
    blobs: BlobStorage
}

#[derive(CandidType, Deserialize)]
struct StableStateInner {
    chats: Vec<ChatStableState>,
    blobs: Vec<(String, u32, Vec<u8>)>
}

impl StableState for StableStateOuter {
    type State = StableStateInner;

    fn drain(self) -> Self::State {
        StableStateInner {
            chats: self.chats.drain(),
            blobs: self.blobs.drain()
        }
    }

    fn fill(source: Self::State) -> Self {
        StableStateOuter {
            chats: ChatList::fill(source.chats),
            blobs: BlobStorage::fill(source.blobs)
        }
    }
}

#[derive(Default)]
struct StableStateOuterPrevious {
    chats: ChatList,
    blobs: BlobStorage
}

#[derive(CandidType, Deserialize)]
struct StableStateInnerPrevious {
    chats: Vec<ChatStableStatePrevious>,
    blobs: Vec<(String, u32, Vec<u8>)>
}

impl StableState for StableStateOuterPrevious {
    type State = StableStateInnerPrevious;

    fn drain(self) -> Self::State {
        unimplemented!()
    }

    fn fill(source: Self::State) -> Self {
        let chats: Vec<ChatStableState> = source.chats
            .into_iter()
            .map(|c| c.into())
            .collect();

        StableStateOuterPrevious {
            chats: ChatList::fill(chats),
            blobs: BlobStorage::fill(source.blobs)
        }
    }
}
