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

impl MigratedTimerJob {
    // Replaces each id the job knows a user by, such as that of the other user in a direct chat, with
    // the one `f` returns, eg. the latest id of a user who has since been migrated
    pub fn map_user_ids(&mut self, f: impl Fn(UserId) -> UserId) {
        match self {
            MigratedTimerJob::HardDeleteMessageContent { chat_id, .. }
            | MigratedTimerJob::MessageReminder {
                chat: Chat::Direct(chat_id),
                ..
            } => *chat_id = f((*chat_id).into()).into(),
            MigratedTimerJob::MarkVideoCallEnded { them, .. } => *them = f(*them),
            MigratedTimerJob::MessageReminder { .. } | MigratedTimerJob::DeleteFileReferences { .. } => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    #[test]
    fn user_ids_in_direct_chats_are_mapped() {
        let f = |id: UserId| if id == user_id(1) { user_id(2) } else { id };
        let mut jobs = [
            MigratedTimerJob::HardDeleteMessageContent {
                chat_id: user_id(1).into(),
                thread_root_message_index: None,
                message_id: 1u64.into(),
            },
            MigratedTimerJob::MessageReminder {
                reminder_id: 1,
                chat: Chat::Direct(user_id(1).into()),
                thread_root_message_index: None,
                event_index: 1.into(),
                notes: None,
                reminder_created_message_index: 1.into(),
            },
            MigratedTimerJob::MarkVideoCallEnded {
                them: user_id(1),
                message_id: 1u64.into(),
            },
            MigratedTimerJob::MarkVideoCallEnded {
                them: user_id(3),
                message_id: 1u64.into(),
            },
        ];

        for job in jobs.iter_mut() {
            job.map_user_ids(f);
        }

        assert!(matches!(jobs[0], MigratedTimerJob::HardDeleteMessageContent { chat_id, .. } if chat_id == user_id(2).into()));
        assert!(
            matches!(jobs[1], MigratedTimerJob::MessageReminder { chat: Chat::Direct(chat_id), .. } if chat_id == user_id(2).into())
        );
        assert!(matches!(jobs[2], MigratedTimerJob::MarkVideoCallEnded { them, .. } if them == user_id(2)));
        assert!(matches!(jobs[3], MigratedTimerJob::MarkVideoCallEnded { them, .. } if them == user_id(3)));
    }
}
