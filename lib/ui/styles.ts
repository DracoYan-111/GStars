// All colors use GitHub Primer CSS variables (they pierce Shadow DOM); light/dark themes follow automatically;
// Falls back to light values when variables are missing.
export const PANEL_CSS = `
:host {
  all: initial;
  display: block;
  color: var(--fgColor-default, #1f2328);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.wrap { margin: 16px 0; }
.notice {
  margin-bottom: 12px; padding: 8px 12px; border-radius: 6px;
  border: 1px solid var(--borderColor-attention-muted, #d4a72c66);
  background: var(--bgColor-attention-muted, #fff8c5);
}
.notice a, .retry { color: var(--fgColor-accent, #0969da); cursor: pointer; text-decoration: underline; background: none; border: 0; font: inherit; padding: 0; }
.search-box { position: relative; }
input[type="search"] {
  width: 100%; padding: 10px 86px 10px 14px; font: inherit; font-size: 16px; border-radius: 6px;
  color: var(--fgColor-default, #1f2328);
  background: var(--bgColor-default, #fff);
  border: 1px solid var(--borderColor-default, #d1d9e0);
}
/* Button group right of the input: random query, search */
.actions { position: absolute; top: 50%; right: 6px; transform: translateY(-50%); display: flex; gap: 2px; }
.icon-button {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 32px; padding: 0; border: 0; border-radius: 6px; cursor: pointer;
  color: var(--fgColor-muted, #59636e); background: transparent;
}
.icon-button:hover { color: var(--fgColor-accent, #0969da); background: var(--bgColor-muted, #f6f8fa); }
.icon-button:focus-visible { outline: 2px solid var(--fgColor-accent, #0969da); }
/* Both button icons wiggle periodically as an affordance; the search icon lags the random one, like roll call.
   One 8s cycle, only the first ~0.8s wiggles, still otherwise. No wiggle when disabled. */
.icon-button:not(:disabled) svg {
  transform-origin: 50% 60%;
  animation: gstars-nudge 8s ease-in-out 2s infinite;
}
.icon-button:not(:disabled) + .icon-button:not(:disabled) svg { animation-delay: 2.25s; }
.icon-button:hover svg { animation-play-state: paused; }
@keyframes gstars-nudge {
  0%, 10%, 100% { transform: rotate(0deg); }
  2% { transform: rotate(-16deg) scale(1.1); }
  4% { transform: rotate(12deg) scale(1.1); }
  6% { transform: rotate(-8deg); }
  8% { transform: rotate(4deg); }
}
/* Hides the native clear button to avoid overlapping the search button */
input[type="search"]::-webkit-search-cancel-button { display: none; }
input[type="search"]:focus { outline: 2px solid var(--fgColor-accent, #0969da); outline-offset: -1px; }
input[type="search"]:disabled { cursor: progress; background: var(--bgColor-muted, #f6f8fa); }
.icon-button:disabled { cursor: progress; opacity: 0.5; background: transparent; }
/* Sync progress ring: overlays the input border, clockwise from the top-left (stroke-dasharray set by script) */
.sync-ring { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.sync-ring rect {
  fill: none; stroke: var(--fgColor-accent, #0969da); stroke-width: 2; stroke-linecap: round;
  stroke-dasharray: 0 100; transition: stroke-dasharray 0.3s ease-out;
}
/* While the total is unknown (star list still loading), a short dash orbits the input */
.sync-ring.indeterminate rect { stroke-dasharray: 16 84; animation: gstars-orbit 1.6s linear infinite; }
.sync-ring.finished { opacity: 0; transition: opacity 0.6s ease-in 0.4s; }
@keyframes gstars-orbit { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
/* x/y count: sits over the top-left border of the input */
.sync-badge {
  position: absolute; top: 0; left: 10px; transform: translateY(-50%);
  display: inline-flex; align-items: center; min-height: 18px; padding: 0 6px;
  font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums;
  color: var(--fgColor-muted, #59636e); background: var(--bgColor-default, #fff);
  border-radius: 9px; pointer-events: none;
}
.sync-badge.complete { color: var(--fgColor-success, #1a7f37); }
.sync-badge.error { color: var(--fgColor-danger, #d1242f); }
.sync-badge svg { display: block; }
.sync-badge-content { display: inline-flex; align-items: center; transition: opacity 0.2s ease, transform 0.2s ease; }
.sync-badge-content.fading { opacity: 0; transform: scale(0.85); }
@media (prefers-reduced-motion: reduce) {
  .sync-ring rect { transition: none; }
  .sync-badge-content { transition: opacity 0.2s ease; }
  .sync-badge-content.fading { transform: none; }
  .sync-ring.indeterminate rect { animation: none; stroke-dasharray: 100 0; opacity: 0.4; }
}
.progress { margin-top: 10px; font-size: 12px; }
.progress.error { color: var(--fgColor-danger, #d1242f); }
.error-banner { margin-top: 10px; color: var(--fgColor-danger, #d1242f); }
.loading, .empty { margin-top: 12px; color: var(--fgColor-muted, #59636e); }
ul { list-style: none; margin: 12px 0 0; padding: 0; }
li {
  padding: 10px 14px; border-radius: 6px; cursor: pointer;
  border: 1px solid transparent; border-bottom-color: var(--borderColor-muted, #d1d9e0b3);
}
/* Top result: a shaking thumbs-up at its top-right. Shakes 3 times (~2.4s) then stops, matching the ~3s animation convention */
li.top { position: relative; padding-right: 44px; }
.top-badge {
  position: absolute; top: 10px; right: 14px;
  display: flex; color: var(--fgColor-attention, #9a6700);
  transform-origin: 50% 80%;
  animation: gstars-wiggle 0.8s ease-in-out 3;
}
.top-badge svg { display: block; }
@keyframes gstars-wiggle {
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(-18deg) scale(1.1); }
  30% { transform: rotate(14deg) scale(1.1); }
  45% { transform: rotate(-10deg); }
  60% { transform: rotate(6deg); }
  75% { transform: rotate(-2deg); }
}
@media (prefers-reduced-motion: reduce) {
  .top-badge, .icon-button svg { animation: none !important; }
}
li[aria-selected="true"] {
  background: var(--bgColor-muted, #f6f8fa);
  border-color: var(--borderColor-accent-emphasis, #0969da);
}
.name { font-weight: 600; font-size: 16px; color: var(--fgColor-accent, #0969da); text-decoration: none; }
.name:hover { text-decoration: underline; }
.desc { margin: 4px 0 0; color: var(--fgColor-default, #1f2328); word-break: break-word; }
.meta { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 12px; color: var(--fgColor-muted, #59636e); }
.lang { display: inline-flex; align-items: center; gap: 4px; }
.lang-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--borderColor-translucent, #1f232826); }
.score { color: var(--fgColor-success, #1a7f37); font-weight: 600; }
`;
