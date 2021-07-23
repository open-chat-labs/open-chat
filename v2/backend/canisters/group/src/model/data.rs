use crate::model::messages::Messages;
use crate::model::participants::Participants;
use candid::Principal;
use shared::time::TimestampMillis;
use shared::types::{CanisterId, UserId};

const ACTIVITY_NOTIFICATION_INTERVAL_MILLIS: u64 = 5 * 60 * 1000; // 5 minutes

pub struct Data {
    pub is_public: bool,
    pub name: String,
    pub description: Option<String>,
    pub participants: Participants,
    pub messages: Messages,
    pub date_created: TimestampMillis,
    pub group_index_canister_id: CanisterId,
    pub notification_canister_ids: Vec<CanisterId>,

    /// When we last notified the group_index canister of activity in this group
    last_activity_notification_date: TimestampMillis,
    activity_notification_in_progress: bool,
}

impl Data {
    pub fn new(
        is_public: bool,
        name: String,
        creator_principal: Principal,
        creator_user_id: UserId,
        now: TimestampMillis,
        group_index_canister_id: CanisterId,
    ) -> Data {
        let participants = Participants::new(creator_principal, creator_user_id, now);

        Data {
            is_public,
            name,
            description: None,
            participants,
            messages: Messages::default(),
            date_created: now,
            group_index_canister_id,
            notification_canister_ids: Vec::new(),
            last_activity_notification_date: now,
            activity_notification_in_progress: false,
        }
    }

    pub fn try_start_activity_notification(&mut self, now: TimestampMillis) -> bool {
        if self.activity_notification_in_progress
            || self.last_activity_notification_date > now.saturating_sub(ACTIVITY_NOTIFICATION_INTERVAL_MILLIS)
        {
            false
        } else {
            self.activity_notification_in_progress = true;
            true
        }
    }

    pub fn mark_activity_notification_succeeded(&mut self, now: TimestampMillis) {
        self.activity_notification_in_progress = false;
        self.last_activity_notification_date = now;
    }

    pub fn mark_activity_notification_failed(&mut self) {
        self.activity_notification_in_progress = false;
    }
}
