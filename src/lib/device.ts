// A one-off guess at how much the device can take, from what the browser exposes:
// little memory, few cores, Save-Data, or a 2G connection all count as low end.
// It only sets the starting quality. The mascot then adjusts to its real frame
// rate, so a wrong guess either way corrects itself.
type DeviceNavigator = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};

const nav = navigator as DeviceNavigator;

export const lowEnd =
  (nav.deviceMemory ?? 8) <= 2 ||
  (navigator.hardwareConcurrency || 8) <= 4 ||
  nav.connection?.saveData === true ||
  /2g$/.test(nav.connection?.effectiveType ?? '');

// Device pixel ratio worth rendering at. Above 2 the extra pixels are rarely visible
// but still cost GPU time, so it's capped there.
export const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
