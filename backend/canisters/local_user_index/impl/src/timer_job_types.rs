use crate::{mutate_state, read_state};
use canister_timer_jobs::Job;
use serde::{Deserialize, Serialize};
use types::{CanisterId, ChatId, UserId};
use user_canister::Event as UserEvent;
use user_index_canister::Event as UserIndexEvent;
use utils::time::SECOND_IN_MS;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    JoinUserToGroup(JoinUserToGroup),
    AddUserToSatoshiDice(AddUserToSatoshiDice),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct JoinUserToGroup {
    pub user_id: UserId,
    pub group_id: ChatId,
    pub attempt: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AddUserToSatoshiDice {
    pub user_id: UserId,
    pub attempt: usize,
}

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::JoinUserToGroup(job) => job.execute(),
            TimerJob::AddUserToSatoshiDice(job) => job.execute(),
        }
    }
}

impl Job for JoinUserToGroup {
    fn execute(&self) {
        if let Some(args) = read_state(|state| {
            state
                .data
                .global_users
                .get_by_user_id(&self.user_id)
                .map(|u| group_canister::c2c_join_group::Args {
                    user_id: self.user_id,
                    principal: u.principal,
                    invite_code: None,
                    correlation_id: 0,
                    is_platform_moderator: u.is_platform_moderator,
                })
        }) {
            ic_cdk::spawn(join_group(self.group_id, args, self.attempt));
        }

        async fn join_group(group_id: ChatId, args: group_canister::c2c_join_group::Args, attempt: usize) {
            use group_canister::c2c_join_group::*;

            match group_canister_c2c_client::c2c_join_group(group_id.into(), &args).await {
                Ok(Response::Success(s) | Response::AlreadyInGroupV2(s)) => mutate_state(|state| {
                    let latest_message_index = s.latest_message.map(|m| m.event.message_index);
                    if state.data.local_users.get(&args.user_id).is_some() {
                        state.push_event_to_user(
                            args.user_id,
                            UserEvent::UserJoinedGroup(Box::new(user_canister::UserJoinedGroup {
                                chat_id: group_id,
                                latest_message_index,
                            })),
                        );
                    } else {
                        state.push_event_to_user_index(UserIndexEvent::UserJoinedGroup(Box::new(
                            user_index_canister::UserJoinedGroup {
                                user_id: args.user_id,
                                chat_id: group_id,
                                as_super_admin: false,
                                latest_message_index,
                            },
                        )))
                    }
                }),
                Ok(Response::InternalError(_)) | Err(_) => {
                    if attempt < 50 {
                        mutate_state(|state| {
                            let now = state.env.now();
                            state.data.timer_jobs.enqueue_job(
                                TimerJob::JoinUserToGroup(JoinUserToGroup {
                                    user_id: args.user_id,
                                    group_id,
                                    attempt: attempt + 1,
                                }),
                                now + 10 * SECOND_IN_MS,
                                now,
                            );
                        })
                    }
                }
                _ => {}
            }
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
