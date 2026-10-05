use crate::User;
use serde::{Deserialize, Serialize};
use types::{BlobReference, Chat, ChatId, EventIndex, MessageId, MessageIndex, TimestampMillis, UserId};

// What a User canister hands over when its user is migrated to a MultiUser canister, serialized when
// the migration starts. Generic over the user so that the User canister can serialize the user it
// holds without cloning them.
#[derive(Serialize, Deserialize)]
pub struct MigratingUser<U = User> {
    pub user: U,
    // The user's timer jobs which the MultiUser canister schedules again, each with when it is due.
    // Those which it rebuilds from the user's state aren't included.
    pub timer_jobs: Vec<(MigratedTimerJob, TimestampMillis)>,
}

// A timer job of a migrating user's, as the User canister hands it over, which the MultiUser canister
// schedules again for the user once it has imported them. Jobs tied to the user's canister, such as
// its calls to the escrow canister or to a group, or the expiry of a swap whose status the escrow
// canister tells it of, can't be handed over, so the user isn't migrated while they have any of those.
#[derive(Serialize, Deserialize, Debug)]
pub enum MigratedTimerJob {
    HardDeleteMessageContent {
        chat_id: ChatId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    },
    DeleteFileReferences {
        files: Vec<BlobReference>,
    },
    MessageReminder {
        reminder_id: u64,
        chat: Chat,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
        notes: Option<String>,
        reminder_created_message_index: MessageIndex,
    },
    MarkVideoCallEnded {
        them: UserId,
        message_id: MessageId,
    },
}
