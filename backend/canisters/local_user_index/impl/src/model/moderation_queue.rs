use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, VecDeque, btree_map};
use tracing::warn;
use types::{CanisterId, ChannelId, ClassifyMessageRequest, MessageId, MessageIndex, ModerationInput, TimestampMillis};

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
    // Keys currently in an in-flight classification batch. Runtime-only: an upgrade kills the
    // in-flight batch (the spawned future is dropped), so both sets start empty afterwards.
    #[serde(skip)]
    in_flight: BTreeSet<(CanisterId, Key)>,
    // In-flight keys whose content was superseded by an edit with nothing classifiable: an
    // empty classification has already been sent for them, so the in-flight result must be
    // discarded (pushing it would re-apply flags derived from the removed content) and a
    // failure must not requeue the stale content
    #[serde(skip)]
    superseded: BTreeSet<(CanisterId, Key)>,
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
    // When the message entered the queue: retryable API failures don't consume attempts, so
    // this bounds how long a message can churn instead. 0 = queued before this field existed;
    // backfilled on first requeue.
    #[serde(default)]
    pub queued_at: TimestampMillis,
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
    // Popped but not classifiable (a media-only entry queued by a pre-#9149 sender): the item
    // is returned so the caller can send an empty classification, clearing any stale flags
    Unclassifiable(Box<QueueItem>),
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
    pub fn enqueue(&mut self, source: CanisterId, is_group: bool, request: ClassifyMessageRequest, now: TimestampMillis) {
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
            queued_at: now,
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

    // Returns the items to classify, plus any unclassifiable items (media-only entries queued
    // by pre-#9149 senders) for which the caller must send an empty classification
    // Batches are bounded by item count and by estimated tokens (~4 chars/token), so that a
    // deep queue drains in batches the API's tokens-per-minute limit can absorb rather than in
    // maximal batches which bounce off it
    pub fn next_batch(&mut self, max_items: usize, max_estimated_tokens: usize) -> (Vec<QueueItem>, Vec<QueueItem>) {
        let mut batch = Vec::new();
        let mut unclassifiable = Vec::new();
        let mut estimated_tokens = 0;

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
                if batch.len() >= max_items || (!batch.is_empty() && estimated_tokens >= max_estimated_tokens) {
                    return (batch, unclassifiable);
                }
                match self.pop(source) {
                    Pop::Item(item) => {
                        self.in_flight.insert((item.source, (item.channel_id, item.message_id)));
                        estimated_tokens += item.entry.input.text.as_ref().map_or(0, |t| t.len() / 4);
                        batch.push(*item);
                        popped_any = true;
                        self.cursor = Some(source);
                    }
                    Pop::Unclassifiable(item) => {
                        unclassifiable.push(*item);
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

        (batch, unclassifiable)
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
        if item.entry.input.is_empty() {
            return Pop::Unclassifiable(Box::new(item));
        }
        Pop::Item(Box::new(item))
    }

    // Marks an in-flight key as superseded by content with nothing classifiable. Returns true
    // if the key was in flight (the caller has already sent the empty classification; the
    // in-flight result will be discarded when its batch completes).
    pub fn mark_superseded_if_in_flight(
        &mut self,
        source: CanisterId,
        channel_id: Option<ChannelId>,
        message_id: MessageId,
    ) -> bool {
        let key = (source, (channel_id, message_id));
        if self.in_flight.contains(&key) {
            self.superseded.insert(key);
            true
        } else {
            false
        }
    }

    // Completes an item's in-flight tracking when its batch finishes. Returns true if the item
    // was superseded while in flight, in which case its result must be discarded (an empty
    // classification has already been sent) and a failure must not requeue it.
    pub fn finish_in_flight(&mut self, source: CanisterId, channel_id: Option<ChannelId>, message_id: MessageId) -> bool {
        let key = (source, (channel_id, message_id));
        self.in_flight.remove(&key);
        self.superseded.remove(&key)
    }

    // Removes a queued entry, eg. when an edit leaves a queued message with nothing classifiable
    pub fn remove(&mut self, source: CanisterId, channel_id: Option<ChannelId>, message_id: MessageId) {
        let key = (channel_id, message_id);
        let removed = self.sources.get_mut(&source).is_some_and(|queue| {
            queue.entries.remove(&key).is_some() && {
                queue.order.retain(|k| *k != key);
                true
            }
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
