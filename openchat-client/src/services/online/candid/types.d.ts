import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type MarkAsOnlineArgs = {};
export type MarkAsOnlineResponse = { 'Success' : null };
export interface _SERVICE {
  'mark_as_online' : ActorMethod<[MarkAsOnlineArgs], MarkAsOnlineResponse>
}
