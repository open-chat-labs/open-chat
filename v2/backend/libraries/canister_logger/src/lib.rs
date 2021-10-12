use candid::CandidType;
use serde::Deserialize;
use std::collections::VecDeque;
use std::fmt::Write;
use std::iter::FromIterator;
use std::ops::Deref;
use std::sync::{Arc, Mutex};
use tracing_subscriber;
use tracing_subscriber::filter::LevelFilter;
use tracing_subscriber::fmt::time::FormatTime;
use types::TimestampMillis;

const DEFAULT_MAX_MESSAGES: usize = 1000;

pub fn init_logger(max_messages: Option<usize>, time_fn: fn() -> TimestampMillis) -> LogMessagesContainer {
    let messages_container = LogMessagesContainer::new(max_messages.unwrap_or(DEFAULT_MAX_MESSAGES));
    let messages_container_clone = messages_container.clone();

    let make_writer = move || LogWriter {
        messages_container: messages_container.clone(),
        time_fn,
        buffer: Vec::new(),
    };

    let timer = Timer { time_fn };

    tracing_subscriber::fmt()
        .with_writer(make_writer)
        .with_timer(timer)
        .with_max_level(LevelFilter::INFO)
        .json()
        .init();

    messages_container_clone
}

#[derive(CandidType, Deserialize, Clone)]
pub struct LogMessage {
    pub timestamp: TimestampMillis,
    pub json: String,
}

struct LogWriter {
    messages_container: LogMessagesContainer,
    time_fn: fn() -> TimestampMillis,
    buffer: Vec<u8>,
}

impl std::io::Write for LogWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.buffer.extend(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        let buffer = std::mem::take(&mut self.buffer);

        self.messages_container.push(LogMessage {
            timestamp: (self.time_fn)(),
            json: String::from_utf8(buffer).unwrap(),
        });
        Ok(())
    }

    fn write_all(&mut self, buf: &[u8]) -> std::io::Result<()> {
        self.write(buf).and_then(|_| self.flush())
    }
}

// Provides shared access to the underlying log messages.
#[derive(Clone, Default)]
pub struct LogMessagesContainer {
    container: Arc<Mutex<LogMessages>>,
}

impl LogMessagesContainer {
    pub fn new(max_messages: usize) -> LogMessagesContainer {
        LogMessagesContainer {
            container: Arc::new(Mutex::new(LogMessages::new(max_messages))),
        }
    }

    pub fn get(&self, since: TimestampMillis) -> Vec<LogMessage> {
        self.container.deref().lock().unwrap().get(since)
    }

    pub fn push(&self, message: LogMessage) {
        self.container.deref().lock().unwrap().push(message);
    }

    pub fn drain_messages(&self) -> Vec<LogMessage> {
        let messages = &mut self.container.deref().lock().unwrap().messages;
        Vec::from_iter(std::mem::take(messages))
    }
}

#[derive(CandidType, Deserialize, Default)]
struct LogMessages {
    max_messages: usize,
    messages: VecDeque<LogMessage>,
}

impl LogMessages {
    pub fn new(max_messages: usize) -> LogMessages {
        LogMessages {
            max_messages,
            messages: VecDeque::new(),
        }
    }

    pub fn get(&self, since: TimestampMillis) -> Vec<LogMessage> {
        self.messages.iter().skip_while(|l| l.timestamp <= since).cloned().collect()
    }

    pub fn push(&mut self, message: LogMessage) {
        while self.messages.len() >= self.max_messages {
            self.messages.pop_front();
        }
        self.messages.push_back(message);
    }
}

struct Timer {
    time_fn: fn() -> TimestampMillis,
}

impl FormatTime for Timer {
    fn format_time(&self, w: &mut dyn Write) -> std::fmt::Result {
        let now = (self.time_fn)();

        w.write_str(&format!("{}", now))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tracing::info;

    #[test]
    fn log_messages_can_be_accessed_outside_of_logger() {
        let messages_container = init_logger(None, || 1);

        info!("test!");

        assert_eq!(1, messages_container.drain_messages().len());
    }
}
