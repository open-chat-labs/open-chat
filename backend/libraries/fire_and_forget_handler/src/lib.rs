use canister_client::make_c2c_call_raw;
use ic_cdk_timers::TimerId;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, HashMap};
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, TimestampMillis};
use utils::time::{now_millis, SECOND_IN_MS};

thread_local! {
    static INIT: Cell<bool> = Cell::default();
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    static HANDLER: RefCell<FireAndForgetHandlerInner> = RefCell::default();
}

fn start_job_if_required() {
    if TIMER_ID.with(|t| t.get().is_none()) && HANDLER.with(|h| !h.borrow().canisters.is_empty()) {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("FireAndForgetHandler job started");
    }
}

fn run() {
    let now = now_millis();
    match HANDLER.with(|h| h.borrow_mut().next_batch(50, now)) {
        NextBatchResult::Success(batch) => ic_cdk::spawn(process_batch(batch)),
        NextBatchResult::Continue => {}
        NextBatchResult::StopJob => {
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("FireAndForgetHandler job stopped");
            }
        }
    }
}

async fn process_batch(batch: Vec<C2cCall>) {
    futures::future::join_all(batch.into_iter().map(process_single)).await;
}

async fn process_single(mut call: C2cCall) {
    let result = make_c2c_call_raw(call.canister_id, &call.method_name, &call.payload).await;

    if result.is_err() || call.attempt > 0 {
        HANDLER.with(|h| {
            let map = &mut h.borrow_mut().canisters;
            let calls = map.entry(call.canister_id).or_default();
            calls.in_progress.retain(|id| *id != call.id);

            if result.is_err() && call.attempt < 50 {
                call.attempt += 1;
                let now = now_millis();
                let due = now + (u64::from(call.attempt) * SECOND_IN_MS);
                calls.queue.insert((due, call.id), call);
            } else if calls.in_progress.is_empty() && calls.queue.is_empty() {
                map.remove(&call.canister_id);
            }
        });
        start_job_if_required();
    }
}

pub struct FireAndForgetHandler {}

impl Default for FireAndForgetHandler {
    fn default() -> Self {
        FireAndForgetHandler::init(FireAndForgetHandlerInner::default())
    }
}

impl FireAndForgetHandler {
    pub fn send(&self, canister_id: CanisterId, method_name: String, payload: Vec<u8>) {
        let id = HANDLER.with(|h| {
            let mut handler = h.borrow_mut();
            let id = handler.next_id;
            handler.next_id += 1;
            id
        });

        let call = C2cCall {
            id,
            canister_id,
            method_name,
            payload,
            attempt: 0,
        };

        ic_cdk::spawn(process_single(call));
    }

    fn init(inner: FireAndForgetHandlerInner) -> Self {
        if INIT.with(|v| v.replace(true)) {
            panic!("Can only initialize a single instance of FireAndForgetHandler");
        }
        HANDLER.with(|h| h.replace(inner));
        start_job_if_required();

        FireAndForgetHandler {}
    }
}

#[derive(Serialize, Deserialize, Default)]
struct FireAndForgetHandlerInner {
    canisters: HashMap<CanisterId, PendingC2cCalls>,
    next_id: u64,
}

enum NextBatchResult {
    Success(Vec<C2cCall>),
    Continue,
    StopJob,
}

impl FireAndForgetHandlerInner {
    fn next_batch(&mut self, max_count: u32, now: TimestampMillis) -> NextBatchResult {
        if self.canisters.is_empty() {
            NextBatchResult::StopJob
        } else {
            let mut results = Vec::new();
            for calls in self.canisters.values_mut().filter(|c| c.in_progress.is_empty()) {
                while calls.queue.first_key_value().map_or(false, |((ts, _), _)| *ts <= now) {
                    results.push(calls.queue.pop_first().unwrap().1);
                    if results.len() as u32 == max_count {
                        break;
                    }
                }
            }

            if results.is_empty() {
                NextBatchResult::Continue
            } else {
                for call in results.iter() {
                    let calls = self.canisters.get_mut(&call.canister_id).unwrap();
                    calls.in_progress.push(call.id);
                }

                NextBatchResult::Success(results)
            }
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
struct PendingC2cCalls {
    in_progress: Vec<u64>,
    queue: BTreeMap<(TimestampMillis, u64), C2cCall>,
}

#[derive(Serialize, Deserialize, Clone)]
struct C2cCall {
    id: u64,
    canister_id: CanisterId,
    method_name: String,
    payload: Vec<u8>,
    attempt: u32,
}

impl Serialize for FireAndForgetHandler {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        HANDLER.with(|h| h.borrow().serialize(serializer))
    }
}

impl<'de> Deserialize<'de> for FireAndForgetHandler {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let inner = FireAndForgetHandlerInner::deserialize(deserializer)?;

        Ok(FireAndForgetHandler::init(inner))
    }
}
