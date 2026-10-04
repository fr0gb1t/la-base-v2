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
