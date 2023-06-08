use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use types::{MentionInternal, MessageIndex, PushIfNotContains, TimestampMillis};

type MainMessageIndex = MessageIndex;
type ThreadMessageIndex = MessageIndex;

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Mentions {
    mentions: BTreeSet<(MainMessageIndex, Option<ThreadMessageIndex>)>,
    by_timestamp: BTreeMap<TimestampMillis, Vec<MentionInternal>>,
}

impl Mentions {
    pub fn add(&mut self, mention: MentionInternal, now: TimestampMillis) -> bool {
        let (main_message_index, thread_message_index) = if let Some(root_message_index) = mention.thread_root_message_index {
            (root_message_index, Some(mention.message_index))
        } else {
            (mention.message_index, None)
        };

        if self.mentions.insert((main_message_index, thread_message_index)) {
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

    pub fn is_empty(&self) -> bool {
        self.by_timestamp.is_empty()
    }
}
