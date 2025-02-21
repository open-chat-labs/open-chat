use crate::AtEveryoneMention;
use serde::{Deserialize, Serialize};
use std::collections::btree_map::Entry::Occupied;
use std::collections::{BTreeMap, BTreeSet};
use types::{Mention, MessageId, MessageIndex, PushIfNotContains, TimestampMillis};

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
    #[serde(rename = "d", default)]
    message_id: MessageId,
}

impl Mentions {
    pub fn add(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_index: MessageIndex,
        message_id: MessageId,
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
                    message_id,
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
            .take_while(move |(&t, _)| since.is_none_or(|s| t > s))
            .flat_map(|(t, m)| {
                m.iter().map(|mention| Mention {
                    timestamp: *t,
                    thread_root_message_index: mention.thread_root_message_index,
                    message_index: mention.message_index,
                    message_id: mention.message_id,
                })
            })
    }

    pub fn iter_potential_at_everyone_mentions(&self) -> impl Iterator<Item = Mention> + '_ {
        self.by_timestamp.iter().flat_map(|(t, m)| {
            m.iter()
                .filter(|m| m.thread_root_message_index.is_none())
                .map(|mention| Mention {
                    timestamp: *t,
                    thread_root_message_index: mention.thread_root_message_index,
                    message_index: mention.message_index,
                    message_id: mention.message_id,
                })
        })
    }

    pub fn remove_at_everyone_mentions(
        &mut self,
        at_everyone_mentions: &BTreeMap<MessageIndex, (TimestampMillis, AtEveryoneMention)>,
    ) -> u32 {
        let mut count = 0;
        for (message_index, (timestamp, _)) in at_everyone_mentions {
            if self.mentions.remove(&(*message_index, None)) {
                count += 1;
                if let Occupied(mut e) = self.by_timestamp.entry(*timestamp) {
                    let mentions = e.get_mut();
                    mentions.retain(|mention| mention.message_index != *message_index);
                    if mentions.is_empty() {
                        e.remove();
                    }
                }
            }
        }
        count
    }

    pub fn is_empty(&self) -> bool {
        self.by_timestamp.is_empty()
    }
}
