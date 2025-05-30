// Inspired by https://github.com/dfinity/ic/blob/master/rs/rust_canisters/canister_log/src/lib.rs

use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::cell::{Cell, RefCell};
use std::collections::VecDeque;
use std::io::Write;
use tracing::Level;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::fmt::time::FormatTime;
use tracing_subscriber::fmt::writer::MakeWriterExt;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{Layer, Registry, fmt};

thread_local! {
    static INITIALIZED: Cell<bool> = Cell::default();
    static ERRORS: RefCell<LogBuffer> = RefCell::new(LogBuffer::default());
    static LOG: RefCell<LogBuffer> = RefCell::new(LogBuffer::default());
    static TRACE: RefCell<LogBuffer> = RefCell::new(LogBuffer::default());
}

pub fn init(enable_trace: bool) {
    if INITIALIZED.replace(true) {
        panic!("Logger already initialized");
    }

    let build_writer = |level, enabled| (move || LogWriter::new(level, enabled)).with_max_level(level);

    let writer = build_writer(Level::ERROR, true)
        .and(build_writer(Level::INFO, true))
        .and(build_writer(Level::TRACE, enable_trace));

    let level_filter = if enable_trace { LevelFilter::TRACE } else { LevelFilter::INFO };

    Registry::default()
        .with(
            fmt::Layer::default()
                .with_writer(writer)
                .json()
                .with_timer(Timer {})
                .with_file(true)
                .with_line_number(true)
                .with_current_span(false)
                .with_span_list(false)
                .with_filter(level_filter),
        )
        .init();
}

pub fn init_with_logs(enable_trace: bool, errors: Vec<LogEntry>, logs: Vec<LogEntry>, traces: Vec<LogEntry>) {
    init(enable_trace);

    for error in errors {
        ERRORS.with_borrow_mut(|l| l.append(error));
    }
    for log in logs {
        LOG.with_borrow_mut(|l| l.append(log));
    }
    if enable_trace {
        for trace in traces {
            TRACE.with_borrow_mut(|t| t.append(trace));
        }
    }
}

/// A circular buffer for log messages.
pub struct LogBuffer {
    max_capacity: usize,
    entries: VecDeque<LogEntry>,
}

impl LogBuffer {
    /// Creates a new buffer of the specified max capacity.
    pub fn with_capacity(max_capacity: usize) -> Self {
        Self {
            max_capacity,
            entries: VecDeque::with_capacity(max_capacity),
        }
    }

    /// Adds a new entry to the buffer, potentially evicting older entries.
    pub fn append(&mut self, entry: LogEntry) {
        while self.entries.len() >= self.max_capacity {
            self.entries.pop_front();
        }
        self.entries.push_back(entry);
    }

    /// Returns an iterator over entries in the order of their insertion.
    pub fn iter(&self) -> impl Iterator<Item = &LogEntry> {
        self.entries.iter()
    }
}

impl Default for LogBuffer {
    fn default() -> Self {
        LogBuffer {
            max_capacity: 100,
            entries: VecDeque::new(),
        }
    }
}

pub fn export_errors() -> Vec<LogEntry> {
    ERRORS.with_borrow(|l| l.iter().cloned().collect())
}

pub fn export_logs() -> Vec<LogEntry> {
    LOG.with_borrow(|l| l.iter().cloned().collect())
}

pub fn export_traces() -> Vec<LogEntry> {
    TRACE.with_borrow(|t| t.iter().cloned().collect())
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub timestamp: u64,
    pub message: String,
}

struct LogWriter {
    level: Level,
    enabled: bool,
    buffer: Vec<u8>,
}

impl LogWriter {
    fn new(level: Level, enabled: bool) -> LogWriter {
        LogWriter {
            level,
            enabled,
            buffer: Vec::new(),
        }
    }
}

impl Write for LogWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        if self.enabled {
            self.buffer.extend(buf);
            Ok(buf.len())
        } else {
            Ok(0)
        }
    }

    fn flush(&mut self) -> std::io::Result<()> {
        if self.enabled {
            let buffer = std::mem::take(&mut self.buffer);
            let json = String::from_utf8(buffer).unwrap();

            let log_entry = LogEntry {
                timestamp: canister_time::now_millis(),
                message: json,
            };

            let sink = if self.level == Level::TRACE {
                &TRACE
            } else if self.level == Level::INFO {
                &LOG
            } else {
                &ERRORS
            };

            sink.with_borrow_mut(|s| s.append(log_entry));
        }
        Ok(())
    }

    fn write_all(&mut self, buf: &[u8]) -> std::io::Result<()> {
        self.write(buf).and_then(|_| self.flush())
    }
}

struct Timer;

impl FormatTime for Timer {
    fn format_time(&self, w: &mut Writer) -> std::fmt::Result {
        let now = canister_time::now_millis();

        w.write_str(&format!("{now}"))
    }
}
