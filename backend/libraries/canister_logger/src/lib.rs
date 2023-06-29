// Inspired by https://github.com/dfinity/ic/blob/master/rs/rust_canisters/canister_log/src/lib.rs

use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::cell::{Cell, RefCell};
use std::collections::VecDeque;
use std::io::Write;
use tracing::Level;
use tracing_subscriber::fmt::format::{FmtSpan, Writer};
use tracing_subscriber::fmt::time::FormatTime;
use tracing_subscriber::fmt::writer::MakeWriterExt;
use tracing_subscriber::fmt::Layer;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::Registry;

thread_local! {
    static INITIALIZED: Cell<bool> = Cell::default();
    static LOG: RefCell<LogBuffer> = RefCell::new(LogBuffer::default());
    static TRACE: RefCell<LogBuffer> = RefCell::new(LogBuffer::default());
}

pub fn init(enable_trace: bool) {
    if INITIALIZED.with(|i| i.replace(true)) {
        panic!("Logger already initialized");
    }

    let log_layer = Layer::default()
        .with_writer((|| LogWriter::new(false)).with_max_level(Level::INFO))
        .json()
        .with_timer(Timer {})
        .with_file(true)
        .with_line_number(true)
        .with_current_span(false)
        .with_span_list(false);

    if enable_trace {
        let trace_layer = Layer::default()
            .with_writer(|| LogWriter::new(true))
            .json()
            .with_timer(Timer {})
            .with_file(true)
            .with_line_number(true)
            .with_current_span(false)
            .with_span_events(FmtSpan::ENTER);

        Registry::default().with(log_layer).with(trace_layer).init();
    } else {
        Registry::default().with(log_layer).init();
    }
}

pub fn init_with_logs(enable_trace: bool, logs: Vec<LogEntry>, traces: Vec<LogEntry>) {
    init(enable_trace);

    for log in logs {
        LOG.with(|l| l.borrow_mut().append(log));
    }
    for trace in traces {
        TRACE.with(|t| t.borrow_mut().append(trace));
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

pub fn export_logs() -> Vec<LogEntry> {
    LOG.with(|l| l.borrow().iter().cloned().collect())
}

pub fn export_traces() -> Vec<LogEntry> {
    TRACE.with(|t| t.borrow().iter().cloned().collect())
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub timestamp: u64,
    pub message: String,
}

struct LogWriter {
    trace: bool,
    buffer: Vec<u8>,
}

impl LogWriter {
    fn new(trace: bool) -> LogWriter {
        LogWriter {
            trace,
            buffer: Vec::new(),
        }
    }
}

impl Write for LogWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.buffer.extend(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        let buffer = std::mem::take(&mut self.buffer);
        let json = String::from_utf8(buffer).unwrap();

        let log_entry = LogEntry {
            timestamp: canister_time::timestamp_millis(),
            message: json,
        };

        let sink = if self.trace { &TRACE } else { &LOG };
        sink.with(|s| s.borrow_mut().append(log_entry));
        Ok(())
    }

    fn write_all(&mut self, buf: &[u8]) -> std::io::Result<()> {
        self.write(buf).and_then(|_| self.flush())
    }
}

struct Timer;

impl FormatTime for Timer {
    fn format_time(&self, w: &mut Writer) -> std::fmt::Result {
        let now = canister_time::timestamp_millis();

        w.write_str(&format!("{now}"))
    }
}
