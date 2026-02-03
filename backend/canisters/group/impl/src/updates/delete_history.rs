use crate::{
    RuntimeState,
    activity_notifications::handle_activity_notification,
    execute_update,
    timer_job_types::{RemoveOldEventsJob, TimerJob},
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::delete_history::*;
use oc_error_codes::OCErrorCode;
use types::{HistoryDeleted, OCResult};

#[update(msgpack = true)]
#[trace]
fn delete_history(args: Args) -> Response {
    execute_update(|state| delete_history_impl(args, state)).into()
}

fn delete_history_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if !member.role().can_delete_history() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    if !state.data.chat.events.any_events_to_delete(args.before) {
        return Err(OCErrorCode::NoEventsToDelete.into());
    }

    let now = state.env.now();

    let result = state.data.chat.events.push_main_event(
        ChatEventInternal::HistoryDeleted(Box::new(HistoryDeleted {
            before: args.before,
            deleted_by: member.user_id(),
        })),
        now,
    );

    state.push_bot_notification(result.bot_notification);

    state.data.timer_jobs.enqueue_job(
        TimerJob::RemoveOldEvents(RemoveOldEventsJob { before: args.before }),
        now,
        now,
    );

    handle_activity_notification(state);
    Ok(())
}
