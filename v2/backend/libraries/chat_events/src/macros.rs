macro_rules! generate_common_methods {
    ($chat_event_event:ident) => {
        pub fn get_range(
            &self,
            from_event_index: EventIndex,
            to_event_index: EventIndex,
        ) -> Vec<EventWrapper<$chat_event_event>> {
            self.inner
                .get_range(from_event_index, to_event_index)
                .iter()
                .map(|e| self.hydrate_event(e))
                .collect()
        }

        pub fn get_by_index(&self, indexes: Vec<EventIndex>) -> Vec<EventWrapper<$chat_event_event>> {
            self.inner
                .get_by_index(indexes)
                .iter()
                .map(|e| self.hydrate_event(e))
                .collect()
        }

        pub fn from_index(
            &self,
            start: EventIndex,
            ascending: bool,
            max_messages: u32,
            max_events: u32,
            min_visible_event_index: EventIndex,
        ) -> Vec<EventWrapper<$chat_event_event>> {
            self.inner
                .from_index(start, ascending, max_messages, max_events, min_visible_event_index)
                .into_iter()
                .map(|e| self.hydrate_event(e))
                .collect()
        }

        pub fn affected_events(&self, events: &[EventWrapper<$chat_event_event>]) -> Vec<EventWrapper<$chat_event_event>> {
            // We use this set to exclude events that are already in the input list
            let event_indexes_set: HashSet<_> = events.iter().map(|e| e.index).collect();

            let affected_event_indexes = events
                .iter()
                .filter_map(|e| {
                    if let Some(affected_event_index) = e.event.affected_event() {
                        if !event_indexes_set.contains(&affected_event_index) {
                            return Some(affected_event_index);
                        }
                    }
                    None
                })
                .unique()
                .collect();

            self.get_by_index(affected_event_indexes)
        }
    };
}
