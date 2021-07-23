use shared::time::TimestampMillis;
use shared::types::chat_id::GroupChatId;

const GROUP_CHAT_ACTIVE_WINDOW_MILLIS: u64 = 11 * 60 * 1000; // 11 minutes (group chats push activity notifications every 5 minutes)

#[allow(dead_code)]
pub struct PublicGroupInfo {
    id: GroupChatId,
    name: String,
    created: TimestampMillis,
    last_notification_of_activity: TimestampMillis,
}

#[allow(dead_code)]
pub struct PrivateGroupInfo {
    id: GroupChatId,
    created: TimestampMillis,
    last_notification_of_activity: TimestampMillis,
}

impl PublicGroupInfo {
    pub fn new(id: GroupChatId, name: String, now: TimestampMillis) -> PublicGroupInfo {
        PublicGroupInfo {
            id,
            name,
            created: now,
            last_notification_of_activity: now,
        }
    }

    pub fn id(&self) -> GroupChatId {
        self.id
    }

    pub fn notify_activity(&mut self, now: TimestampMillis) {
        self.last_notification_of_activity = now;
    }

    pub fn is_active(&self, now: TimestampMillis) -> bool {
        now.saturating_sub(self.last_notification_of_activity) < GROUP_CHAT_ACTIVE_WINDOW_MILLIS
    }
}

impl PrivateGroupInfo {
    pub fn new(id: GroupChatId, now: TimestampMillis) -> PrivateGroupInfo {
        PrivateGroupInfo {
            id,
            created: now,
            last_notification_of_activity: now,
        }
    }

    pub fn id(&self) -> GroupChatId {
        self.id
    }

    pub fn notify_activity(&mut self, now: TimestampMillis) {
        self.last_notification_of_activity = now;
    }

    pub fn is_active(&self, now: TimestampMillis) -> bool {
        now.saturating_sub(self.last_notification_of_activity) < GROUP_CHAT_ACTIVE_WINDOW_MILLIS
    }
}
