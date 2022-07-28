use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{MentionInternal, MessageIndex, PushIfNotContains, TimestampMillis};

type ThreadMessageIndex = MessageIndex;

#[derive(Deserialize, Serialize, Default, Clone)]
pub struct Mentions {
    by_message_index: BTreeMap<MessageIndex, Vec<Option<ThreadMessageIndex>>>,
    by_timestamp: BTreeMap<TimestampMillis, Vec<MentionInternal>>,
}

impl Mentions {
    pub fn add(&mut self, mention: MentionInternal, now: TimestampMillis) -> bool {
        let message_index = mention.thread_root_message_index.unwrap_or(mention.message_index);

        let thread_message_index = mention.thread_root_message_index.is_some().then_some(mention.message_index);
        if self
            .by_message_index
            .entry(message_index)
            .or_default()
            .push_if_not_contains(thread_message_index)
        {
            self.by_timestamp.entry(now).or_default().push_if_not_contains(mention);
            true
        } else {
            false
        }
    }

    pub fn iter_most_recent(&self, since: Option<TimestampMillis>) -> impl Iterator<Item = &MentionInternal> {
        self.by_timestamp
            .iter()
            .rev()
            .take_while(move |(&t, _)| since.map_or(true, |s| t > s))
            .flat_map(|(_, m)| m.iter())
    }
}
