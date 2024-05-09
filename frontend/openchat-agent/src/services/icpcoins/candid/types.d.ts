import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type LatestTokenRow = [[TokenId, TokenId], string, number];
export type TokenId = bigint;
export interface _SERVICE {
  'get_latest' : ActorMethod<[], Array<LatestTokenRow>>,
}
