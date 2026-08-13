use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque, btree_map};
use tracing::warn;
use types::{CanisterId, ChannelId, ClassifyMessageRequest, MessageId, MessageIndex, ModerationInput};

// Caps so that a prolonged OpenAI outage or a flood of messages cannot grow the queue
// unboundedly; the oldest entries are dropped first so the most recent messages still get
// moderated
const PER_SOURCE_CAP: usize = 2_000;
const TOTAL_CAP: usize = 20_000;
// Text is truncated to this many chars at enqueue time; it is plenty for the classifier and it
// bounds the heap held by a full queue
const MAX_TEXT_CHARS: usize = 4_000;

type Key = (Option<ChannelId>, MessageId);

// Messages queued for classification via the moderation API, keyed by the group/community
// canister which owns them. Queued messages are deduped by message id (an edit replaces the
// queued content in place) and batches are taken round-robin across sources so that a single
// busy chat cannot starve the rest of the subnet.
#[derive(Serialize, Deserialize, Default)]
pub struct ModerationQueue {
    sources: BTreeMap<CanisterId, SourceQueue>,
    cursor: Option<CanisterId>,
    total: usize,
}

#[derive(Serialize, Deserialize)]
struct SourceQueue {
    is_group: bool,
    entries: BTreeMap<Key, Entry>,
    order: VecDeque<Key>,
}

#[derive(Serialize, Deserialize)]
pub struct Entry {
    pub thread_root_message_index: Option<MessageIndex>,
    pub input: ModerationInput,
    pub attempts: u8,
}

pub struct QueueItem {
    pub source: CanisterId,
    pub is_group: bool,
    pub channel_id: Option<ChannelId>,
    pub message_id: MessageId,
    pub entry: Entry,
}

enum Pop {
    Item(Box<QueueItem>),
    // Popped but discarded (nothing classifiable) - progress was made, but there is no item
    Dropped,
    SourceEmpty,
}

impl ModerationQueue {
    pub fn len(&self) -> usize {
        self.total
    }

    pub fn is_empty(&self) -> bool {
        self.total == 0
    }

    // Empty inputs never reach here - the caller handles them (dequeue + immediate empty
    // classification, see c2c_group_or_community_canister)
    pub fn enqueue(&mut self, source: CanisterId, is_group: bool, request: ClassifyMessageRequest) {
        let key = (request.channel_id, request.message_id);
        let mut input = request.input;
        if let Some(text) = input.text.as_mut()
            && let Some((index, _)) = text.char_indices().nth(MAX_TEXT_CHARS)
        {
            text.truncate(index);
        }
        // Never read (only text is classified); cleared so a full queue holds no URL heap,
        // matching the MAX_TEXT_CHARS memory-bounding intent
        input.image_urls = Vec::new();
        let entry = Entry {
            thread_root_message_index: request.thread_root_message_index,
            input,
            attempts: 0,
        };
        self.insert(source, is_group, key, entry, false);
    }

    // Failed items are requeued unless a newer edit of the same message has arrived in the
    // meantime, in which case the newer content wins
    pub fn requeue(&mut self, item: QueueItem) {
        self.insert(
            item.source,
            item.is_group,
            (item.channel_id, item.message_id),
            item.entry,
            true,
        );
    }

    pub fn next_batch(&mut self, max_items: usize) -> Vec<QueueItem> {
        let mut batch = Vec::new();

        loop {
            let mut source_ids: Vec<CanisterId> = self.sources.keys().copied().collect();
            if source_ids.is_empty() {
                break;
            }
            // Rotate so that iteration continues after the last source served
            if let Some(cursor) = self.cursor {
                let split = source_ids.partition_point(|id| *id <= cursor);
                source_ids.rotate_left(split);
            }

            let mut popped_any = false;
            for source in source_ids {
                if batch.len() >= max_items {
                    return batch;
                }
                match self.pop(source) {
                    Pop::Item(item) => {
                        batch.push(*item);
                        popped_any = true;
                        self.cursor = Some(source);
                    }
                    Pop::Dropped => {
                        popped_any = true;
                        self.cursor = Some(source);
                    }
                    Pop::SourceEmpty => {}
                }
            }

            if !popped_any {
                break;
            }
        }

        batch
    }

    fn pop(&mut self, source: CanisterId) -> Pop {
        let popped = {
            let Some(queue) = self.sources.get_mut(&source) else {
                return Pop::SourceEmpty;
            };
            let Some(key) = queue.order.pop_front() else {
                return Pop::SourceEmpty;
            };
            queue.entries.remove(&key).map(|entry| QueueItem {
                source,
                is_group: queue.is_group,
                channel_id: key.0,
                message_id: key.1,
                entry,
            })
        };

        let Some(item) = popped else {
            return Pop::SourceEmpty;
        };

        self.total = self.total.saturating_sub(1);
        if self.sources.get(&source).is_some_and(|q| q.order.is_empty()) {
            self.sources.remove(&source);
        }
        // An entry queued by a pre-#9149 sender may carry media without text; only text is
        // classified, so it is discarded rather than "classified" without an API call
        if item.entry.input.is_empty() {
            return Pop::Dropped;
        }
        Pop::Item(Box::new(item))
    }

    // Removes a queued entry, eg. when an edit leaves a queued message with nothing classifiable
    pub fn remove(&mut self, source: CanisterId, channel_id: Option<ChannelId>, message_id: MessageId) {
        let key = (channel_id, message_id);
        let removed = self
            .sources
            .get_mut(&source)
            .is_some_and(|queue| queue.entries.remove(&key).is_some() && {
                queue.order.retain(|k| *k != key);
                true
            });

        if removed {
            self.total = self.total.saturating_sub(1);
            if self.sources.get(&source).is_some_and(|q| q.order.is_empty()) {
                self.sources.remove(&source);
            }
        }
    }

    fn insert(&mut self, source: CanisterId, is_group: bool, key: Key, entry: Entry, skip_if_present: bool) {
        let (added, over_source_cap) = {
            let source_queue = self.sources.entry(source).or_insert_with(|| SourceQueue {
                is_group,
                entries: BTreeMap::new(),
                order: VecDeque::new(),
            });

            match source_queue.entries.entry(key) {
                btree_map::Entry::Occupied(mut o) => {
                    if !skip_if_present {
                        // Replace the content of an already queued message (eg. it has been edited
                        // again); its position in the queue is retained
                        o.insert(entry);
                    }
                    (false, false)
                }
                btree_map::Entry::Vacant(v) => {
                    v.insert(entry);
                    source_queue.order.push_back(key);
                    (true, source_queue.order.len() > PER_SOURCE_CAP)
                }
            }
        };

        if added {
            self.total += 1;
            if over_source_cap {
                self.drop_oldest_from_source(source);
            }
            if self.total > TOTAL_CAP {
                self.drop_oldest_from_largest_source();
            }
        }
    }

    fn drop_oldest_from_source(&mut self, source: CanisterId) {
        let dropped = self
            .sources
            .get_mut(&source)
            .and_then(|queue| queue.order.pop_front().map(|oldest| queue.entries.remove(&oldest).is_some()))
            .unwrap_or(false);

        if dropped {
            self.total = self.total.saturating_sub(1);
            warn!(%source, "Moderation queue full, dropping oldest entry");
        }
    }

    fn drop_oldest_from_largest_source(&mut self) {
        if let Some(source) = self.sources.iter().max_by_key(|(_, q)| q.order.len()).map(|(id, _)| *id) {
            self.drop_oldest_from_source(source);
            if self.sources.get(&source).is_some_and(|q| q.order.is_empty()) {
                self.sources.remove(&source);
            }
        }
    }
}
