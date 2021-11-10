mod panic_hook;

pub use panic_hook::set_panic_hook;

use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fmt::Write;
use std::iter::FromIterator;
use std::ops::Deref;
use std::sync::{Arc, Mutex};
use tracing::Level;
use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::fmt::time::FormatTime;
use tracing_subscriber::fmt::writer::MakeWriterExt;
use tracing_subscriber::fmt::Layer;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::Registry;
use types::TimestampMillis;

const DEFAULT_MAX_MESSAGES: usize = 100;

pub fn init_logger(enable_trace: bool, max_messages: Option<usize>, time_fn: fn() -> TimestampMillis) -> LogMessagesWrapper {
    let log_messages_container = LogMessagesContainer::new(max_messages.unwrap_or(DEFAULT_MAX_MESSAGES));
    let trace_messages_container = LogMessagesContainer::new(max_messages.unwrap_or(DEFAULT_MAX_MESSAGES));

    let log_messages_wrapper = LogMessagesWrapper {
        logs: log_messages_container.clone(),
        traces: trace_messages_container.clone(),
    };

    let make_log_writer = move || LogWriter {
        messages_container: log_messages_container.clone(),
        time_fn,
        buffer: Vec::new(),
    };

    let make_trace_writer = move || LogWriter {
        messages_container: trace_messages_container.clone(),
        time_fn,
        buffer: Vec::new(),
    };

    let timer = Timer { time_fn };

    let log_layer = Layer::default()
        .with_writer(make_log_writer.with_max_level(Level::INFO))
        .with_timer(timer.clone())
        .json()
        .with_current_span(false)
        .with_span_list(false);

    if enable_trace {
        let trace_layer = Layer::default()
            .with_writer(make_trace_writer)
            .with_timer(timer)
            .with_span_events(FmtSpan::ENTER)
            .json()
            .with_current_span(false);

        Registry::default().with(log_layer).with(trace_layer).init();
    } else {
        Registry::default().with(log_layer).init();
    }

    log_messages_wrapper
}

#[derive(Default)]
pub struct LogMessagesWrapper {
    pub logs: LogMessagesContainer,
    pub traces: LogMessagesContainer,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
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

#[derive(CandidType, Serialize, Deserialize, Default)]
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

#[derive(Clone)]
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
    use tracing::{info, instrument};

    #[test]
    fn log_messages_can_be_accessed_outside_of_logger() {
        let log_messages = init_logger(true, None, || 1);

        info!("test!");

        assert_eq!(1, log_messages.logs.drain_messages().len());
        assert_eq!(1, log_messages.traces.drain_messages().len());

        add_one(1);

        assert_eq!(1, log_messages.logs.drain_messages().len());
        assert_eq!(2, log_messages.traces.drain_messages().len());
    }

    #[instrument(level = "trace")]
    fn add_one(value: u32) -> u32 {
        info!("abc");
        value + 1
    }
}
