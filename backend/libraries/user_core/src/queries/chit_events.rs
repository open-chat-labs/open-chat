use crate::User;
use user_canister::chit_events::{Args, SuccessResult};

pub fn chit_events(user: &User, args: Args) -> SuccessResult {
    let (events, total) = user.chit_events.events(
        args.from,
        args.to,
        args.skip.unwrap_or_default() as usize,
        args.max as usize,
        args.ascending,
    );

    SuccessResult { events, total }
}
