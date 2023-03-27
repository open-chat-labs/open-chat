import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type ExchangeId = number;
export interface UpdateConfigArgs {
  'exchange_id' : ExchangeId,
  'max_orders_to_cancel_per_iteration' : [] | [number],
  'min_order_size' : [] | [bigint],
  'price_increment' : [] | [bigint],
  'min_orders_per_direction' : [] | [number],
  'enabled' : [] | [boolean],
  'min_sell_price' : [] | [bigint],
  'order_size' : [] | [bigint],
  'max_buy_price' : [] | [bigint],
  'max_orders_to_make_per_iteration' : [] | [number],
  'max_orders_per_direction' : [] | [number],
}
export type UpdateConfigResponse = { 'ExchangeNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'InternalError' : string };
export interface _SERVICE {
  'update_config' : ActorMethod<[UpdateConfigArgs], UpdateConfigResponse>,
}
