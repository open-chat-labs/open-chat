use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use types::{Mention, MessageIndex, PushIfNotContains, TimestampMillis};

type MainMessageIndex = MessageIndex;
type ThreadMessageIndex = MessageIndex;

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Mentions {
    mentions: BTreeSet<(MainMessageIndex, Option<ThreadMessageIndex>)>,
    by_timestamp: BTreeMap<TimestampMillis, Vec<MentionInternal>>,
}

#[derive(Serialize, Deserialize, Clone, Eq, PartialEq)]
struct MentionInternal {
    #[serde(rename = "t", default, skip_serializing_if = "Option::is_none")]
    thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "i")]
    message_index: MessageIndex,
}

impl Mentions {
    pub fn add(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_index: MessageIndex,
        now: TimestampMillis,
    ) -> bool {
        let (main_message_index, thread_message_index) = if let Some(root_message_index) = thread_root_message_index {
            (root_message_index, Some(message_index))
        } else {
            (message_index, None)
        };

        if self.mentions.insert((main_message_index, thread_message_index)) {
            self.by_timestamp
                .entry(now)
                .or_default()
                .push_if_not_contains(MentionInternal {
                    thread_root_message_index,
                    message_index,
                });
            true
        } else {
            false
        }
    }

    pub fn iter_most_recent(&self, since: Option<TimestampMillis>) -> impl Iterator<Item = Mention> + '_ {
        self.by_timestamp
            .iter()
            .rev()
            .take_while(move |(&t, _)| since.map_or(true, |s| t > s))
            .flat_map(|(t, m)| {
                m.iter().map(|mention| Mention {
                    timestamp: *t,
                    thread_root_message_index: mention.thread_root_message_index,
                    message_index: mention.message_index,
                })
            })
    }

    pub fn is_empty(&self) -> bool {
        self.by_timestamp.is_empty()
    }
}
