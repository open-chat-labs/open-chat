use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::rc::Rc;
use std::time::Duration;

/// A repeating timer which runs its callback at most once per round: on every round
/// ([`new`](PerRoundTimer::new)), or every `interval`
/// ([`new_with_interval`](PerRoundTimer::new_with_interval)). Constructing the timer starts it,
/// and dropping (or [`clear`](PerRoundTimer::clear)ing) it stops it.
///
/// This is a replacement for `set_timer_interval`, which must not be used for frequently repeating
/// jobs: under ic-cdk-timers 1.0, interval timers reschedule themselves relative to the time they
/// were previously *due*, so a timer that falls behind schedule (eg. an interval shorter than the
/// gap between rounds, or downtime spanning several intervals) "catches up" by re-firing
/// repeatedly within a single round, bounded only by the per-timer concurrent call limit (or for a
/// zero interval, spinning until the instruction limit is hit). `PerRoundTimer` instead chains
/// one-shot timers, scheduling each execution only once the previous one completes, so executions
/// can never stack up, and there is no schedule to fall behind: after downtime the timer simply
/// resumes.
pub struct PerRoundTimer {
    inner: Rc<PerRoundTimerInner>,
}

struct PerRoundTimerInner {
    timer_id: Cell<Option<TimerId>>,
    interval: Duration,
    callback: Box<dyn Fn()>,
}

impl PerRoundTimer {
    /// Starts a timer which will run `callback` once per round.
    pub fn new(callback: impl Fn() + 'static) -> Self {
        Self::new_with_interval(Duration::ZERO, callback)
    }

    /// Starts a timer which will run `callback` every `interval` (at most once per round).
    pub fn new_with_interval(interval: Duration, callback: impl Fn() + 'static) -> Self {
        let inner = Rc::new(PerRoundTimerInner {
            timer_id: Cell::default(),
            interval,
            callback: Box::new(callback),
        });
        Self::arm(&inner);
        PerRoundTimer { inner }
    }

    /// Returns true while the timer is running (ie. it has not been cleared).
    pub fn is_set(&self) -> bool {
        self.inner.timer_id.get().is_some()
    }

    /// Stops the timer.
    pub fn clear(&self) {
        if let Some(timer_id) = self.inner.timer_id.take() {
            ic_cdk_timers::clear_timer(timer_id);
        }
    }

    fn arm(inner: &Rc<PerRoundTimerInner>) {
        // The pending one-shot holds only a weak reference to the timer's state, so that dropping
        // the `PerRoundTimer` drops the state and stops the timer.
        let weak = Rc::downgrade(inner);
        let timer_id = ic_cdk_timers::set_timer(inner.interval, async move {
            let Some(inner) = weak.upgrade() else { return };
            (inner.callback)();
            // Only schedule the next execution if the timer wasn't cleared during the callback...
            let cleared = inner.timer_id.get().is_none();
            // ... and wasn't dropped during the callback, in which case this is the final strong
            // reference, so dropping it here causes the upgrade below to fail.
            drop(inner);
            if !cleared && let Some(inner) = weak.upgrade() {
                PerRoundTimer::arm(&inner);
            }
        });
        inner.timer_id.set(Some(timer_id));
    }
}

impl Drop for PerRoundTimer {
    fn drop(&mut self) {
        self.clear();
    }
}
