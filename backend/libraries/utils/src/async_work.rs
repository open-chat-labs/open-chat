use std::cell::Cell;

thread_local! {
    // The async work which hasn't yet completed, whose remaining steps could still change the
    // canister's state. Not persisted, since a canister being upgraded is stopped first, so has none.
    static ASYNC_WORK_IN_PROGRESS: Cell<u32> = const { Cell::new(0) };
}

// Counts some async work as in progress for as long as it is held, by the future doing the work. That
// future is dropped when the work completes. If the work traps after an await, it relies on ic-cdk
// dropping the future during the cleanup of the call whose callback trapped: ic-cdk cancels both the
// task which made that call (which is how a migratory task is dropped) and the tasks attached to
// the current method (which is how an update's own future is dropped). If the work traps before
// its first await, the increment is rolled back along with everything else.
pub struct AsyncWorkGuard(());

impl AsyncWorkGuard {
    #[expect(clippy::new_without_default)]
    pub fn new() -> AsyncWorkGuard {
        ASYNC_WORK_IN_PROGRESS.set(ASYNC_WORK_IN_PROGRESS.get() + 1);
        AsyncWorkGuard(())
    }
}

impl Drop for AsyncWorkGuard {
    fn drop(&mut self) {
        ASYNC_WORK_IN_PROGRESS.set(ASYNC_WORK_IN_PROGRESS.get().saturating_sub(1));
    }
}

pub fn async_work_in_progress() -> bool {
    ASYNC_WORK_IN_PROGRESS.get() > 0
}

// Spawns a task, counting it as async work in progress until it completes
pub fn spawn_tracked(future: impl Future<Output = ()> + 'static) {
    let guard = AsyncWorkGuard::new();
    ic_cdk::futures::spawn_migratory(async move {
        let _guard = guard;
        future.await;
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn work_is_in_progress_while_a_guard_is_held() {
        assert!(!async_work_in_progress());

        let guard1 = AsyncWorkGuard::new();
        let guard2 = AsyncWorkGuard::new();
        assert!(async_work_in_progress());

        drop(guard1);
        assert!(async_work_in_progress());

        drop(guard2);
        assert!(!async_work_in_progress());
    }
}
