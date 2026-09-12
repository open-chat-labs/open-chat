use crate::mutate_state;
use oc_error_codes::{OCError, OCErrorCode};
use serde::{Deserialize, Serialize};
use timer_job_queues::{TimerJobItem, TimerJobQueue};
use tracing::error;
use types::{C2CError, Milliseconds, PuzzleNumber, UserId};
use user_canister::c2c_game_chit::{Args, Response, SuccessResult};
use utils::canister::delay_if_should_retry_failed_c2c_call;

// One CHIT credit or debit against a user canister. Keys are idempotent on the user side, so a
// retry after an ambiguous failure is safe: a repeat answers `AlreadyAdded`, which counts as done.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GameChitCredit {
    pub user_id: UserId,
    pub game_id: String,
    pub key: String,
    pub amount: i32,
    // Set for a daily puzzle solve reward. The inline path zeroes the recorded reward when the
    // user canister will never credit it; the retry path has to be able to do the same, or the
    // record goes on claiming CHIT the balance never received.
    #[serde(default)]
    pub puzzle_number: Option<PuzzleNumber>,
}

pub type GameChitCreditRetryQueue = TimerJobQueue<GameChitCredit>;

pub fn new_retry_queue() -> GameChitCreditRetryQueue {
    TimerJobQueue::new(5, true)
}

pub enum GameChitOutcome {
    // Applied now (with the balances the user canister reported), or already applied under this
    // key (`AlreadyAdded` carries no balance, so None)
    Applied(Option<SuccessResult>),
    // The user canister refused it (eg. InsufficientFunds): never retry
    Refused(OCError),
    // The call failed before an answer: retry if the error is transient
    Failed(C2CError),
}

pub async fn apply(credit: &GameChitCredit) -> GameChitOutcome {
    let response = user_canister_c2c_client::c2c_game_chit(
        credit.user_id.canister_id(),
        &Args {
            game_id: credit.game_id.clone(),
            key: credit.key.clone(),
            amount: credit.amount,
        },
    )
    .await;

    match response {
        Ok(Response::Success(result)) => GameChitOutcome::Applied(Some(result)),
        Ok(Response::Error(error)) if error.matches_code(OCErrorCode::AlreadyAdded) => GameChitOutcome::Applied(None),
        Ok(Response::Error(error)) => GameChitOutcome::Refused(error),
        Err(error) => GameChitOutcome::Failed(error),
    }
}

impl GameChitCredit {
    // Nothing more will be tried for this credit, so stop reporting a reward that was never paid
    fn abandon(&self) {
        if let Some(number) = self.puzzle_number {
            mutate_state(|state| {
                state
                    .data
                    .daily_puzzle_engine
                    .clear_reward(self.user_id, &self.game_id, number)
            });
        }
    }
}

impl TimerJobItem for GameChitCredit {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        match apply(self).await {
            GameChitOutcome::Applied(_) => Ok(()),
            GameChitOutcome::Refused(error) => {
                error!(?error, key = %self.key, user_id = %self.user_id, "Game CHIT credit refused, dropping");
                self.abandon();
                Ok(())
            }
            GameChitOutcome::Failed(error) => {
                let delay = delay_if_should_retry_failed_c2c_call(&error);
                if delay.is_none() {
                    error!(?error, key = %self.key, user_id = %self.user_id, "Game CHIT credit failed, dropping");
                    self.abandon();
                }
                Err(delay)
            }
        }
    }
}
