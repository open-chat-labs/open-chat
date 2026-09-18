use crate::mutate_state;
use canister_timer_jobs::Job;
use serde::{Deserialize, Serialize};
use types::{ChatId, MessageId, MessageIndex};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(Box<HardDeleteMessageContentJob>),
}

// Removes the content of a deleted message from one user's copy of a direct chat, once the time in
// which the message can be undeleted has passed
#[derive(Serialize, Deserialize, Clone)]
pub struct HardDeleteMessageContentJob {
    // The index of the user whose copy of the chat holds the message
    pub user_index: u16,
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(self) {
        mutate_state(|state| {
            let now = state.env.now();
            state.data.users.with_user_mut(self.user_index, |user| {
                user.direct_chats
                    .get_mut(&self.chat_id)
                    .and_then(|chat| chat.remove_deleted_message_content(self.thread_root_message_index, self.message_id, now))
            });
            // TODO: If the message is the user's own, delete the files it references and cancel
            // any P2P swap it holds which is still open, as the User canister does. Each copy of
            // the chat references the same files, so they must only be deleted once, from the
            // sender's copy.
        });
    }
}
