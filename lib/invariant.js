// src/invariant.ts
var PACKAGE_NAME = "dsh-desktop-safe-market";
var name = "dsh-desktop-safe-market-invariant";
var inject = ["invariants"];
var install = () => {
};
var apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=invariant.js.map
