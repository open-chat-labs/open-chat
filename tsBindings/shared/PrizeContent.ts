// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { Cryptocurrency } from "./Cryptocurrency";
import type { UserId } from "./UserId";

export type PrizeContent = { prizes_remaining: number, prizes_pending: number, winners: Array<UserId>, winner_count: number, user_is_winner: boolean, token: Cryptocurrency, end_date: bigint, caption?: string, diamond_only: boolean, lifetime_diamond_only: boolean, unique_person_only: boolean, streak_only: number, };
