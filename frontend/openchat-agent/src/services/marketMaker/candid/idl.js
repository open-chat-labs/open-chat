export const idlFactory = ({ IDL }) => {
  const ExchangeId = IDL.Nat32;
  const UpdateConfigArgs = IDL.Record({
    'exchange_id' : ExchangeId,
    'max_orders_to_cancel_per_iteration' : IDL.Opt(IDL.Nat32),
    'min_order_size' : IDL.Opt(IDL.Nat64),
    'price_increment' : IDL.Opt(IDL.Nat64),
    'min_orders_per_direction' : IDL.Opt(IDL.Nat32),
    'enabled' : IDL.Opt(IDL.Bool),
    'min_sell_price' : IDL.Opt(IDL.Nat64),
    'order_size' : IDL.Opt(IDL.Nat64),
    'max_buy_price' : IDL.Opt(IDL.Nat64),
    'max_orders_to_make_per_iteration' : IDL.Opt(IDL.Nat32),
    'max_orders_per_direction' : IDL.Opt(IDL.Nat32),
  });
  const UpdateConfigResponse = IDL.Variant({
    'ExchangeNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  return IDL.Service({
    'update_config' : IDL.Func([UpdateConfigArgs], [UpdateConfigResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
