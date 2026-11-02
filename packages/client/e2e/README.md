# e2e tests

They run against their **own** server and client, never the ones players use (port 3000 is the
real game, published through the tunnel):

```sh
# test server (LABASE_TEST enables test:rig — never on a public port)
cd packages/server && LABASE_TEST=1 LABASE_ROOM_TTL_MS=1500 LABASE_CLEANUP_MS=300 PORT=3100 node --import tsx ./src/index.ts
# test client, pointed at the test server
cd packages/client && VITE_SERVER_URL=http://localhost:3100 npx vite --port 5174
```

Then e.g. `node e2e/table.e2e.mjs /tmp/out` or `node ../server/e2e/rules.e2e.mjs`.
The 3D rulebook: `OUT=/tmp node e2e/rulebook.3d.mjs` (drag, click, catch, arrows) and
`node e2e/rulebook.shots.mjs /tmp/rb` (every spread).

The señas lab (everybody signing all the time, the reading rule's knobs and its zones drawn on the table; no server
needed): `pnpm --filter client dev`, then open `/senas-lab.html`. `node e2e/senas.lab.mjs /tmp/out` checks the rule.

## Known quirks of headless Chromium here

- `table.e2e.mjs` used to hang forever at its first `page.keyboard.type()` (it only surfaced as `Target closed`
  when the run was killed): headless Chromium leaves the first key event unanswered on a page nobody has touched.
  The script now calls `page.bringToFront()` first.
- Inside the 3D lobby, synthetic key events are answered after tens of seconds (even keys the app ignores, like
  Shift) because the CPU is busy drawing the table; typing the 6-letter room code took minutes. The script writes the
  code straight into the focused hidden `<input>` instead. This is the headless browser, not the game: it does not
  happen with a real window and GPU. A full run takes about two minutes.

## Performance

`node e2e/perf.measure.mjs <out> [seconds]` plays a game like `table.e2e.mjs` and reports frame times, what blocks
the main thread (long animation frames, attributed to source files through the source map), the CPU cost of each render
pass, and the end-of-hand «listo» window. Options: `CPU=4` (throttle), `SMOOTH=on|off` (the «Bordes suaves» setting),
`PROFILE=1` (CPU sampling; then `node e2e/perf.callers.mjs <out>-profile.json getProgram` shows who calls a hot
function). Build the client for production with `--sourcemap` and `VITE_SERVER_URL=http://localhost:3100` first.

