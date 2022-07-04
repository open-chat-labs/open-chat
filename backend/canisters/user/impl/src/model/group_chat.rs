use serde::{Deserialize, Serialize};
use std::cmp::max;
use types::{ChatId, GroupChatSummaryUpdates, MessageIndex, OptionUpdate, TimestampMillis, Timestamped};
use utils::range_set::{convert_to_message_index_ranges, RangeSet};
use utils::time::WEEK_IN_MS;

#[derive(Serialize, Deserialize)]
pub struct GroupChat {
    pub chat_id: ChatId,
    pub date_joined: TimestampMillis,
    pub read_by_me: Timestamped<RangeSet>,
    pub notifications_muted: Timestamped<bool>,
    pub is_super_admin: bool,
    #[serde(default)]
    recent_proposal_votes: Timestamped<RecentProposalVotes>,
}

impl GroupChat {
    pub fn new(
        chat_id: ChatId,
        is_super_admin: bool,
        notifications_muted: bool,
        read_up_to: Option<MessageIndex>,
        now: TimestampMillis,
    ) -> GroupChat {
        let mut read_by_me = RangeSet::new();
        if let Some(index) = read_up_to {
            read_by_me.insert_range(0..=index.into());
        }

        GroupChat {
            chat_id,
            date_joined: now,
            read_by_me: Timestamped::new(read_by_me, now),
            notifications_muted: Timestamped::new(notifications_muted, now),
            is_super_admin,
            recent_proposal_votes: Timestamped::default(),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        max(
            self.read_by_me.timestamp,
            max(self.notifications_muted.timestamp, self.recent_proposal_votes.timestamp),
        )
    }

    pub fn record_proposal_vote(&mut self, message_index: MessageIndex, now: TimestampMillis) {
        self.recent_proposal_votes.value.add(message_index, now);
        self.recent_proposal_votes.timestamp = now;
    }

    pub fn recent_proposal_votes(&self, since: Option<TimestampMillis>, now: TimestampMillis) -> Vec<MessageIndex> {
        self.recent_proposal_votes.get(since, now)
    }

    pub fn to_updates(&self, now: TimestampMillis) -> GroupChatSummaryUpdates {
        GroupChatSummaryUpdates {
            chat_id: self.chat_id,
            last_updated: self.last_updated(),
            name: None,
            description: None,
            avatar_id: OptionUpdate::NoChange,
            latest_message: None,
            latest_event_index: None,
            participant_count: None,
            role: None,
            read_by_me: Some(convert_to_message_index_ranges(self.read_by_me.value.clone())),
            notifications_muted: Some(self.notifications_muted.value),
            mentions: Vec::new(),
            pinned_message: OptionUpdate::NoChange,
            wasm_version: None,
            owner_id: None,
            permissions: None,
            recent_proposal_votes: self.recent_proposal_votes.get(None, now),
            affected_events: Vec::new(),
            metrics: None,
            my_metrics: None,
            is_public: None,
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
struct RecentProposalVotes(Vec<(MessageIndex, TimestampMillis)>);

impl RecentProposalVotes {
    pub fn add(&mut self, message_index: MessageIndex, now: TimestampMillis) {
        self.0.retain(|(_, t)| !Self::is_expired(*t, now));
        self.0.push((message_index, now));
    }

    pub fn get(&self, since: Option<TimestampMillis>, now: TimestampMillis) -> Vec<MessageIndex> {
        self.0
            .iter()
            .filter(|(_, t)| !Self::is_expired(*t, now) && since.map_or(true, |s| *t > s))
            .map(|(m, _)| *m)
            .collect()
    }

    fn is_expired(vote_timestamp: TimestampMillis, now: TimestampMillis) -> bool {
        now.saturating_sub(vote_timestamp) > WEEK_IN_MS
    }
}
