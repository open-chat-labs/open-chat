// The typebox definitions are order-sensitive at module evaluation time - a definition which
// references another before it has been initialized throws a TDZ ReferenceError which kills the
// worker on startup. Nothing else evaluates the module in tests, so do it here.
test("typebox module evaluates without error", async () => {
    const typebox = await import("./typebox");
    expect(typebox.MessageContent).toBeDefined();
});
