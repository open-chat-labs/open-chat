export const idlFactory = ({ IDL }) => {
  const MarkAsOnlineArgs = IDL.Record({});
  const MarkAsOnlineResponse = IDL.Variant({ 'Success' : IDL.Null });
  return IDL.Service({
    'mark_as_online' : IDL.Func([MarkAsOnlineArgs], [MarkAsOnlineResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
