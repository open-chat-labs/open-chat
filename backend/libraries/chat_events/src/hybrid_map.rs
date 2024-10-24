use crate::{ChatEventInternal, ChatEventsMap, EventsMap};
use serde::{Deserialize, Serialize};
use std::cell::Cell;
use std::collections::BTreeMap;
use std::ops::RangeBounds;
use types::{EventIndex, EventWrapperInternal, MAX_EVENT_INDEX, MIN_EVENT_INDEX};

#[cfg(test)]
thread_local! {
    static LAST_READ_FROM_SLOW: Cell<bool> = Cell::new(false);
}

fn set_last_read_from_slow(value: bool) {
    #[cfg(test)]
    {
        LAST_READ_FROM_SLOW.set(value);
    }
}

#[derive(Serialize, Deserialize)]
pub struct HybridMap<MSlow> {
    fast: BTreeMap<EventIndex, EventWrapperInternal<ChatEventInternal>>,
    slow: MSlow,
    latest_event_index: EventIndex,
    max_events_in_fast_map: u32,
}

impl<MSlow> HybridMap<MSlow> {
    fn fast_start(&self) -> EventIndex {
        self.fast.keys().next().copied().unwrap_or_default()
    }

    fn fast_end(&self) -> EventIndex {
        self.fast.keys().last().copied().unwrap_or_default()
    }
}

impl<MSlow: EventsMap> EventsMap for HybridMap<MSlow> {
    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        if event_index > self.latest_event_index {
            set_last_read_from_slow(false);
            None
        } else if let Some(event) = self.fast.get(&event_index) {
            set_last_read_from_slow(false);
            Some(event.clone())
        } else {
            set_last_read_from_slow(true);
            self.slow.get(event_index)
        }
    }

    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>) {
        if event.index > self.latest_event_index {
            self.latest_event_index = event.index;
        }
        let fast_cut_off = EventIndex::from(u32::from(self.latest_event_index).saturating_sub(self.max_events_in_fast_map));
        if event.index >= fast_cut_off {
            self.fast.insert(event.index, event.clone());
            while self.fast.len() > self.max_events_in_fast_map as usize {
                self.fast.pop_first();
            }
        }
        self.slow.insert(event);
    }

    fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.fast.remove(&event_index);
        self.slow.remove(event_index)
    }

    fn range<R: RangeBounds<EventIndex>>(
        &self,
        range: R,
    ) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(Iter::new(self, range))
    }

    fn iter(&self) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        self.range(EventIndex::default()..=self.latest_event_index)
    }
}

struct Iter<'a, MSlow: EventsMap> {
    next: EventIndex,
    next_back: EventIndex,
    fast_start: EventIndex,
    fast_end: EventIndex,
    fast: &'a BTreeMap<EventIndex, EventWrapperInternal<ChatEventInternal>>,
    slow: &'a MSlow,
    fast_forward_iter: Option<Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + 'a>>,
    fast_backward_iter: Option<Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + 'a>>,
    slow_forward_iter: Option<Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + 'a>>,
    slow_backward_iter: Option<Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + 'a>>,
    finished: bool,
}

impl<'a, MSlow: EventsMap> Iter<'a, MSlow> {
    fn new<R: RangeBounds<EventIndex>>(map: &'a HybridMap<MSlow>, range: R) -> Self {
        let next = match range.start_bound() {
            std::ops::Bound::Included(i) => *i,
            std::ops::Bound::Excluded(i) => i.incr(),
            std::ops::Bound::Unbounded => MIN_EVENT_INDEX,
        };
        if next > map.latest_event_index {
            return Iter::empty(map);
        }

        let mut next_back = match range.end_bound() {
            std::ops::Bound::Included(i) => *i,
            std::ops::Bound::Excluded(i) if *i == MIN_EVENT_INDEX => return Iter::empty(map),
            std::ops::Bound::Excluded(i) => i.decr(),
            std::ops::Bound::Unbounded => MAX_EVENT_INDEX,
        };
        if next_back > map.latest_event_index {
            next_back = map.latest_event_index;
        }
        Iter {
            next,
            next_back,
            fast_start: map.fast_start(),
            fast_end: map.fast_end(),
            fast: &map.fast,
            slow: &map.slow,
            fast_forward_iter: None,
            fast_backward_iter: None,
            slow_forward_iter: None,
            slow_backward_iter: None,
            finished: false,
        }
    }

    fn empty(map: &'a HybridMap<MSlow>) -> Self {
        Self {
            next: EventIndex::default(),
            next_back: EventIndex::default(),
            fast_start: EventIndex::default(),
            fast_end: EventIndex::default(),
            fast: &map.fast,
            slow: &map.slow,
            fast_forward_iter: None,
            fast_backward_iter: None,
            slow_forward_iter: None,
            slow_backward_iter: None,
            finished: true,
        }
    }
}

impl<MSlow: EventsMap> Iterator for Iter<'_, MSlow> {
    type Item = EventWrapperInternal<ChatEventInternal>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.finished || self.next > self.fast_end {
            set_last_read_from_slow(false);
            return None;
        }
        let next = if self.next >= self.fast_start {
            set_last_read_from_slow(false);
            if self.fast_forward_iter.is_none() {
                self.fast_forward_iter = Some(Box::new(self.fast.range(self.next..=self.next_back).map(|(_, e)| e.clone())));
            }
            self.fast_forward_iter.as_mut().unwrap().next()
        } else {
            set_last_read_from_slow(true);
            if self.slow_forward_iter.is_none() {
                self.slow_forward_iter = Some(self.slow.range(self.next..=self.next_back));
            }
            self.slow_forward_iter.as_mut().unwrap().next()
        };
        if let Some(event) = &next {
            self.next = event.index.incr();
            if self.next <= self.next_back {
                return next;
            }
        }
        self.finished = true;
        next
    }
}

impl<MSlow: EventsMap> DoubleEndedIterator for Iter<'_, MSlow> {
    fn next_back(&mut self) -> Option<Self::Item> {
        if self.finished {
            set_last_read_from_slow(false);
            return None;
        }
        let next = if self.fast_start <= self.next_back {
            set_last_read_from_slow(false);
            if self.fast_backward_iter.is_none() {
                self.fast_backward_iter = Some(Box::new(self.fast.range(self.next..=self.next_back).map(|(_, e)| e.clone())));
            }
            self.fast_backward_iter.as_mut().unwrap().next_back()
        } else {
            set_last_read_from_slow(true);
            if self.slow_backward_iter.is_none() {
                self.slow_backward_iter = Some(self.slow.range(self.next..=self.next_back));
            }
            self.slow_backward_iter.as_mut().unwrap().next_back()
        };
        if let Some(event) = &next {
            if event.index > EventIndex::default() {
                self.next_back = event.index.decr();
                if self.next <= self.next_back {
                    return next;
                }
            }
        }
        self.finished = true;
        next
    }
}

#[test]
fn get() {
    let map = setup_map();

    for i in 0u32..100 {
        let index = i.into();
        let event = map.get(index).unwrap();
        assert_eq!(event.index, index);
        assert_eq!(LAST_READ_FROM_SLOW.get(), event.index < EventIndex::from(90));
    }

    assert!(map.get(100.into()).is_none());
    assert!(!LAST_READ_FROM_SLOW.get());
}

#[test]
fn iter() {
    let map = setup_map();

    let mut expected = EventIndex::default();
    for event in map.iter() {
        assert_eq!(event.index, expected);
        assert_eq!(LAST_READ_FROM_SLOW.get(), event.index < EventIndex::from(90));
        expected = expected.incr();
    }
    assert_eq!(expected, 100.into());
    assert!(!LAST_READ_FROM_SLOW.get());
}

#[test]
fn iter_rev() {
    let map = setup_map();

    let mut expected = EventIndex::from(100);
    for event in map.iter().rev() {
        expected = expected.decr();
        assert_eq!(event.index, expected);
        assert_eq!(LAST_READ_FROM_SLOW.get(), event.index < EventIndex::from(90));
    }
    assert_eq!(expected, 0.into());
    assert!(!LAST_READ_FROM_SLOW.get());
}

#[test]
fn range() {
    let map = setup_map();

    let start = EventIndex::from(5);
    let end = EventIndex::from(95);
    let mut expected = start;
    for event in map.range(start..=end) {
        assert_eq!(event.index, expected);
        assert_eq!(LAST_READ_FROM_SLOW.get(), event.index < EventIndex::from(90));
        expected = expected.incr();
    }
    assert_eq!(expected, end.incr());
    assert!(!LAST_READ_FROM_SLOW.get());
}

#[test]
fn range_rev() {
    let map = setup_map();

    let start = EventIndex::from(5);
    let end = EventIndex::from(95);
    let mut expected = end;
    for event in map.range(start..end).rev() {
        expected = expected.decr();
        assert_eq!(event.index, expected);
        assert_eq!(LAST_READ_FROM_SLOW.get(), event.index < EventIndex::from(90));
    }
    assert_eq!(expected, start);
    assert!(!LAST_READ_FROM_SLOW.get());
}

#[test]
fn iter_both_ends() {
    let map = setup_map();

    let mut iter = map.iter();
    for i in 0u32..50 {
        let event = iter.next().unwrap();
        assert_eq!(event.index, EventIndex::from(i));
        assert!(LAST_READ_FROM_SLOW.get());

        let event = iter.next_back().unwrap();
        assert_eq!(event.index, EventIndex::from(99 - i));
        assert_eq!(LAST_READ_FROM_SLOW.get(), event.index < EventIndex::from(90));
    }
    assert!(iter.next().is_none());
    assert!(!LAST_READ_FROM_SLOW.get());
}

fn setup_map() -> HybridMap<ChatEventsMap> {
    let mut map = HybridMap {
        fast: BTreeMap::new(),
        slow: ChatEventsMap::default(),
        latest_event_index: EventIndex::default(),
        max_events_in_fast_map: 10,
    };

    for i in 0u32..100 {
        map.insert(EventWrapperInternal {
            index: i.into(),
            timestamp: i.into(),
            event: ChatEventInternal::Empty,
            correlation_id: 0,
            expires_at: None,
        });
    }

    map
}
