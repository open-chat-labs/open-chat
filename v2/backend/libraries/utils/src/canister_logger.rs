use candid::CandidType;
use serde::Deserialize;
use slog::{o, Drain, FnValue, Logger, PushFnValue, Record};
use slog_scope::set_global_logger;
use std::collections::VecDeque;
use std::iter::FromIterator;
use std::ops::Deref;
use std::sync::{Arc, Mutex};
use types::TimestampMillis;

const DEFAULT_MAX_MESSAGES: usize = 1000;

pub fn init_logger(max_messages: Option<usize>) -> LoggerWrapper {
    let messages_container = LogMessagesContainer::new(max_messages.unwrap_or(DEFAULT_MAX_MESSAGES));

    let time_fn = || ic_cdk::api::time();
    let writer = LogWriter {
        messages_container: messages_container.clone(),
        time_fn,
        buffer: Vec::new(),
    };

    let drain = slog_json::Json::new(writer).set_pretty(false).set_flush(true).build();

    let logger = slog::Logger::root(
        Mutex::new(drain).fuse(),
        o!(
        "ts" => PushFnValue(move |_ : &Record, ser| {
            ser.emit(ic_cdk::api::time())
        }),
        "level" => FnValue(move |rinfo : &Record| {
            rinfo.level().as_short_str()
        }),
        "msg" => PushFnValue(move |record : &Record, ser| {
            ser.emit(record.msg())
        })),
    );

    set_global_logger(logger.clone()).cancel_reset();

    LoggerWrapper {
        logger,
        messages_container,
    }
}

pub struct LoggerWrapper {
    logger: Logger,
    messages_container: LogMessagesContainer,
}

impl LoggerWrapper {
    pub fn messages_container(&self) -> &LogMessagesContainer {
        &self.messages_container
    }
}

impl Deref for LoggerWrapper {
    type Target = Logger;

    fn deref(&self) -> &Self::Target {
        &self.logger
    }
}

impl Default for LoggerWrapper {
    fn default() -> Self {
        let logger = slog::Logger::root(slog::Discard, o!());

        LoggerWrapper {
            logger,
            messages_container: LogMessagesContainer::default(),
        }
    }
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
