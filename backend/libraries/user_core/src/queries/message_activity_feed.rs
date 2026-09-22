use crate::User;
use user_canister::message_activity_feed::{Args, SuccessResult};

pub fn message_activity_feed(user: &User, args: Args) -> SuccessResult {
    SuccessResult {
        events: user.message_activity_events.latest_events(args.since),
        total: user.message_activity_events.len(),
    }
}
