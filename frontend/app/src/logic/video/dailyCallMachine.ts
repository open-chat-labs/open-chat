import pin from "../../../daily-call-machine.json";

/**
 * Where a Daily call object loads its call machine from: our own origin, the pinned copy that
 * fetch-daily-call-machine.mjs puts in public/daily/ (#10124). Never Daily's servers, and never
 * through eval: the CSP allows neither.
 */
export function dailyCallMachineUrl(origin: string = location.origin): string {
    return `${origin}/daily/call-machine-object-bundle-${pin.version}.js`;
}

export const DAILY_CALL_MACHINE_VERSION: string = pin.version;
