//! The direct chat model shared by the User canister and the MultiUser canister.
//!
//! A direct chat is split in two. [`DirectChatCore`] holds what both users see identically: the
//! events and each user's read position. [`DirectChat`] wraps a core with the state which belongs
//! to one user alone: who the other user is, whether they have muted or archived the chat, and the
//! map from our message indexes to theirs which is needed while each user's canister holds its own
//! copy of the chat. Two users in the same MultiUser canister will share a single core, with each
//! holding their own per-user state.

mod direct_chat;
mod direct_chat_core;
mod direct_chats;
pub mod private_replies;
pub mod removed_chats;
pub mod unread_message_index_map;

pub use direct_chat::DirectChat;
pub use direct_chat_core::{DirectChatCore, Participant};
pub use direct_chats::DirectChats;
pub use unread_message_index_map::UnreadMessageIndexMap;
