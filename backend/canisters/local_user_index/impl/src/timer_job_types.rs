use crate::{mutate_state, read_state};
use canister_timer_jobs::Job;
use serde::{Deserialize, Serialize};
use types::{CanisterId, UserId};
use utils::time::SECOND_IN_MS;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    AddUserToSatoshiDice(AddUserToSatoshiDice),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AddUserToSatoshiDice {
    pub user_id: UserId,
    pub attempt: usize,
}

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::AddUserToSatoshiDice(job) => job.execute(),
        }
    }
}

impl Job for AddUserToSatoshiDice {
    fn execute(&self) {
        ic_cdk::spawn(add_user(self.user_id, self.attempt));

        async fn add_user(user_id: UserId, attempt: usize) {
            let test_mode = read_state(|state| state.data.test_mode);
            let canister_id =
                CanisterId::from_text(if test_mode { "uuw5d-uiaaa-aaaar-anzeq-cai" } else { "wznbi-caaaa-aaaar-anvea-cai" })
                    .unwrap();

            if satoshi_dice_canister_c2c_client::c2c_add_user(
                canister_id,
                &satoshi_dice_canister::c2c_add_user::Args { user_id },
            )
            .await
            .is_err()
                && attempt < 50
            {
                mutate_state(|state| {
                    let now = state.env.now();
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::AddUserToSatoshiDice(AddUserToSatoshiDice {
                            user_id,
                            attempt: attempt + 1,
                        }),
                        now + 10 * SECOND_IN_MS,
                        now,
                    );
                })
            }
        }
    }
}
