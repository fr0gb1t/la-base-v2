// Rules regression tests against a real server started with:
//   LABASE_TEST=1 LABASE_ROOM_TTL_MS=1500 LABASE_CLEANUP_MS=300 node --import tsx src/index.ts
// Usage: node e2e/rules.e2e.mjs [http://localhost:3000]
import { io } from 'socket.io-client'
import { gazeToward } from '@la-base/shared'

const SERVER = process.argv[2] ?? 'http://localhost:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

async function table({ kamikazes = 2, powers = { espadas: true, copas: true, oros: true }, structure = 'clasica' } = {}) {
  const ps = []
  for (let i = 0; i < 4; i++) {
    const s = io(SERVER, { transports: ['websocket'], forceNew: true })
    await new Promise((r) => s.on('connect', r))
    const p = { s, id: s.id, state: null, hand: [], emit: (ev, pl) => new Promise((r) => s.emit(ev, pl, r)) }
    s.on('game:state', (st) => (p.state = st))
    s.on('player:hand', (d) => (p.hand = d.hand))
    ps.push(p)
  }
  const room = (await ps[0].emit('room:create', { playerName: 'P0', playerCount: 4 })).roomCode
  for (let i = 1; i < 4; i++) await ps[i].emit('room:join', { roomCode: room, playerName: `P${i}` })
  await ps[0].emit('game:config', { roomCode: room, structure, acePowers: powers, kamikazesPerTeam: kamikazes })
  await ps[0].emit('game:start', { roomCode: room })
  const byId = (id) => ps.find((p) => p.id === id)
  const st = () => ps[0].state
  const until = async (pred, ms = 8000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if (st() && pred(st())) return true
      await sleep(40)
    }
    return false
  }
  // initial draw
  await until((s) => s.phase === 'initial_draw')
  while (st().phase === 'initial_draw' && !st().initialDraw.completed) {
    await byId(st().initialDraw.currentDrawerPlayerId).emit('draw:initialCard', { roomCode: room })
    await sleep(60)
  }
  await until((s) => s.phase === 'bidding')
  const order = (await ps[0].emit('test:rig', { roomCode: room, hands: {} })).order // seating order
  const rig = (hands) => ps[0].emit('test:rig', { roomCode: room, hands })
  const teamOf = (id) => order.find((o) => o.id === id).team
  return { ps, room, byId, st, until, order, rig, teamOf, close: () => ps.forEach((p) => p.s.disconnect()) }
}

const C = (value, suit) => ({ value, suit })

// ---------------------------------------------------------------- A. kamikazes are per team
{
  const t = await table({ kamikazes: 1 })
  const mano = t.st().currentBidPlayerId
  const manoTeam = t.teamOf(mano)
  const max = t.st().structureSequence[t.st().roundIndex]
  const r1 = await t.byId(mano).emit('bid:declare', { roomCode: t.room, bidValue: max, isKamikaze: true })
  await t.until((s) => s.bids.length === 1)
  const left = t.st().kamikazesRemaining
  const other = manoTeam === 'nosotros' ? 'ellos' : 'nosotros'
  check('kamikaze accepted', r1.success, r1.error)
  check('using one kamikaze only spends the declaring team’s', left[manoTeam] === 0 && left[other] === 1, JSON.stringify(left))
  t.close()
}

// ---------------------------------------------------------------- B. As de Copas inversion skips players who already played
{
  const t = await table({ structure: 'postpandemia' }) // round 1 = 1 base
  const o = t.order.map((x) => x.id)
  const mano = t.st().currentBidPlayerId
  const mi = o.indexOf(mano)
  const at = (k) => o[(mi - k + 4 * 4) % 4] // antihorario = decreasing index
  // mano plays first, then at(1) plays the As de Copas and inverts → next must be at(3), not mano
  await t.rig({ [at(0)]: [C(4, 'oros')], [at(1)]: [C(1, 'copas')], [at(2)]: [C(5, 'oros')], [at(3)]: [C(6, 'oros')] })
  const max = t.st().structureSequence[0]
  await t.byId(mano).emit('bid:declare', { roomCode: t.room, bidValue: 0 })
  await t.until((s) => s.bids.length === 1)
  const pie = t.st().currentBidPlayerId
  await t.byId(pie).emit('bid:declare', { roomCode: t.room, bidValue: max === 1 ? 0 : 1, isKamikaze: false })
  await t.until((s) => s.phase === 'playing')
  await t.byId(at(0)).emit('card:play', { roomCode: t.room, card: C(4, 'oros') })
  await t.until((s) => s.currentTurnPlayerId === at(1))
  const r = await t.byId(at(1)).emit('card:play', { roomCode: t.room, card: C(1, 'copas'), copasDirection: 'invertir' })
  await sleep(150)
  check('As de Copas played and inverted', r.success && t.st().playDirection === 'horario', r.error)
  check('after inverting, the turn goes to the next player who has NOT played', t.st().currentTurnPlayerId === at(3), `turn=${o.indexOf(t.st().currentTurnPlayerId)} expected=${o.indexOf(at(3))}`)
  const r3 = await t.byId(at(3)).emit('card:play', { roomCode: t.room, card: C(6, 'oros') })
  await sleep(150)
  const r4 = await t.byId(at(2)).emit('card:play', { roomCode: t.room, card: C(5, 'oros') })
  const resolved = await t.until((s) => s.readyGate != null)
  check('the base completes (no deadlock)', r3.success && r4.success && resolved, `${r3.error ?? ''} ${r4.error ?? ''}`)
  t.close()
}

// ---------------------------------------------------------------- C. As de Oros on the LAST base: no choice; next Mano = first to receive cards
{
  const t = await table({ structure: 'postpandemia' }) // round 1 = 1 base (it is the last base)
  const o = t.order.map((x) => x.id)
  const mano = t.st().currentBidPlayerId
  const mi = o.indexOf(mano)
  const at = (k) => o[(mi - k + 16) % 4]
  // at(0) plays As de Oros, its teammate at(2) wins with a Rey
  await t.rig({ [at(0)]: [C(1, 'oros')], [at(1)]: [C(4, 'copas')], [at(2)]: [C(12, 'bastos')], [at(3)]: [C(5, 'copas')] })
  await t.byId(mano).emit('bid:declare', { roomCode: t.room, bidValue: 1 })
  await t.until((s) => s.bids.length === 1)
  await t.byId(t.st().currentBidPlayerId).emit('bid:declare', { roomCode: t.room, bidValue: 1 })
  await t.until((s) => s.phase === 'playing')
  const dealer1 = t.st().dealerPlayerId
  for (const k of [0, 1, 2, 3]) {
    await t.until((s) => s.currentTurnPlayerId === at(k))
    await t.byId(at(k)).emit('card:play', { roomCode: t.room, card: t.byId(at(k)).hand[0] })
  }
  await t.until((s) => s.readyGate?.kind === 'round')
  for (const p of t.ps) await p.emit('game:ready', { roomCode: t.room })
  await t.until((s) => s.phase === 'bidding' && s.roundIndex === 1)
  const s2 = t.st()
  const di = o.indexOf(dealer1)
  const expectedDealer = o[(di - 1 + 4) % 4]
  const expectedMano = o[(di - 2 + 4) % 4]
  check('no As de Oros choice on the last base', !s2.pendingOrosChoice)
  check('the deal rotates antihorario', s2.dealerPlayerId === expectedDealer)
  check('next round Mano = first to receive cards (after the dealer)', s2.currentManoPlayerId === expectedMano && s2.currentBidPlayerId === expectedMano)
  const r = await t.byId(expectedMano).emit('bid:declare', { roomCode: t.room, bidValue: 0 })
  check('the new Mano can declare', r.success, r.error)
  t.close()
}

// ---------------------------------------------------------------- D. a room is never deleted while players sit at it
{
  const t = await table()
  await sleep(2500) // > LABASE_ROOM_TTL_MS with several cleanup passes
  const mano = t.st().currentBidPlayerId
  const r = await t.byId(mano).emit('bid:declare', { roomCode: t.room, bidValue: 0 })
  check('room survives the abandon timeout while players are connected', r.success, r.error)
  t.close()
}

// ---------------------------------------------------------------- E. señas: validated, rate-limited, and only sent to who can see them
{
  const t = await table()
  const signer = t.ps[0]
  const mate = t.ps.find((p) => p !== signer && t.teamOf(p.id) === t.teamOf(signer.id))
  const rival = t.ps.find((p) => t.teamOf(p.id) !== t.teamOf(signer.id))
  const got = new Map()
  for (const p of t.ps) p.s.on('sena:made', (d) => got.set(p.id, [...(got.get(p.id) ?? []), d]))
  rival.s.emit('presence:look', { roomCode: t.room, yaw: 0, pitch: -0.34 }) // eyes on the table
  await sleep(250)
  const ok = await signer.emit('sena:make', { roomCode: t.room, sena: 'tres' })
  const bad = await signer.emit('sena:make', { roomCode: t.room, sena: 'falso' })
  const fast = await signer.emit('sena:make', { roomCode: t.room, sena: 'dos' })
  await sleep(300)
  const m = got.get(mate.id) ?? []
  check('a seña reaches the partner with who made it', ok.success && m.length === 1 && m[0].playerId === signer.id && m[0].sena === 'tres', JSON.stringify(m))
  check('nothing at all reaches a rival who is not looking at the signer', !(got.get(rival.id) ?? []).length, JSON.stringify(got.get(rival.id)))
  check('unknown señas and floods are rejected', !bad.success && !fast.success)
  t.close()
}

// ---------------------------------------------------------------- G. a tie after the last round: two tiebreak rounds, not a win for Ellos
{
  const t = await table()
  const mano = t.st().currentBidPlayerId
  const manoTeam = t.teamOf(mano)
  const other = manoTeam === 'nosotros' ? 'ellos' : 'nosotros'
  // the last round of the clásica (1 base): the Mano holds a rey, everybody else a low card; the
  // scores are set so that Mano's team (+11 for 1 of 1) and the other (−1, asked 1 got 0) end level
  const hands = {}
  t.order.forEach((o, i) => (hands[o.id] = [o.id === mano ? C(12, 'oros') : C(4 + i, 'copas')]))
  await t.ps[0].emit('test:rig', { roomCode: t.room, hands, roundIndex: 11, scores: { [manoTeam]: 50, [other]: 62 } })
  await t.byId(mano).emit('bid:declare', { roomCode: t.room, bidValue: 1 })
  await t.until((s) => s.bids.length === 1)
  await t.byId(t.st().currentBidPlayerId).emit('bid:declare', { roomCode: t.room, bidValue: 1 })
  await t.until((s) => s.phase === 'playing')
  for (let k = 0; k < 4; k++) {
    await t.until((s) => Boolean(s.currentTurnPlayerId) || Boolean(s.readyGate))
    const turn = t.st().currentTurnPlayerId
    if (!turn || t.st().readyGate) break
    await t.byId(turn).emit('card:play', { roomCode: t.room, card: hands[turn][0] })
    await sleep(80)
  }
  for (let g = 0; g < 2; g++) {
    await t.until((s) => Boolean(s.readyGate))
    for (const p of t.ps) await p.emit('game:ready', { roomCode: t.room })
    await sleep(150)
  }
  await t.until((s) => s.tiebreak === true || s.phase === 'game_over')
  const s = t.st()
  check('a tie after the last round adds two tiebreak rounds with the most bases', s.tiebreak === true && s.structureSequence.length === 14 && s.structureSequence.slice(-2).every((n) => n === 5) && s.phase !== 'game_over', `phase ${s.phase} rounds ${s.structureSequence.length} scores ${JSON.stringify(s.scores)}`)
  t.close()
}

// ---------------------------------------------------------------- F. asking for señas: rival bots watch the answer; bots ask before bidding
{
  const s = io(SERVER, { transports: ['websocket'], forceNew: true })
  await new Promise((r) => s.on('connect', r))
  const emit = (ev, pl) => new Promise((r) => s.emit(ev, pl, r))
  let roster = []
  let state = null
  const made = []
  const asked = []
  s.on('room:updated', (d) => (roster = d.players))
  s.on('game:state', (st) => (state = st))
  s.on('sena:made', (d) => made.push({ ...d, t: Date.now() }))
  s.on('sena:asked', (d) => asked.push(d.playerId))
  const looks = new Map()
  s.on('presence:look', (d) => looks.set(d.playerId, d))
  let hand = []
  s.on('player:hand', (d) => (hand = d.hand))
  const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
  for (let i = 0; i < 3; i++) await emit('room:addBot', { roomCode: room })
  await sleep(800)
  await emit('game:start', { roomCode: room })
  for (let i = 0; i < 200 && state?.phase !== 'bidding'; i++) {
    if (state?.phase === 'initial_draw' && state.initialDraw?.currentDrawerPlayerId === s.id) await emit('draw:initialCard', { roomCode: room })
    await sleep(60)
  }
  const myTeam = roster.find((p) => p.id === s.id)?.team
  const mate = roster.find((p) => p.id !== s.id && p.team === myTeam)
  await sleep(12000) // let the deal-time señas pass (bots are busy facing partners meanwhile)
  const r = await emit('sena:ask', { roomCode: room })
  await sleep(1200)
  check('asking for señas is relayed', r.success)
  // answering is up to the partner (bots can be distracted); the rivals, though, turn to watch
  // the face of whoever has to answer
  const order = roster.map((p) => p.id)
  const rivals = roster.filter((p) => p.team !== myTeam)
  const watching = rivals.filter((p) => {
    const l = looks.get(p.id)
    const g = gazeToward(order.indexOf(p.id), order.indexOf(mate.id), order.length)
    return l && Math.abs(l.yaw - g.yaw) < 0.02 && Math.abs(l.pitch - g.pitch) < 0.02
  })
  check('after a knock, rival bots watch the face of the partner who must answer', watching.length > 0, `${watching.length}/${rivals.length}`)
  // the host never signs: when declaring for the team falls to its bot partner, the bot knocks first
  let mateDeclared = false
  for (let i = 0; i < 1200 && !asked.includes(mate.id); i++) {
    if (state?.phase === 'bidding' && state.currentBidPlayerId === s.id) await emit('bid:declare', { roomCode: room, bidValue: 0 })
    if (state?.phase === 'bidding' && state.currentBidPlayerId === mate.id) mateDeclared = true
    if (state?.readyGate && !state.readyGate.readyPlayerIds.includes(s.id)) await emit('game:ready', { roomCode: room })
    if (state?.phase === 'playing' && state.currentTurnPlayerId === s.id && hand.length) await emit('card:play', { roomCode: room, card: hand[0], copasDirection: 'mantener' })
    if (state?.pendingOrosChoice?.chooserPlayerId === s.id) await emit('ace:oros:choose', { roomCode: room, playerId: state.pendingOrosChoice.options[0] })
    await sleep(100)
  }
  check('a bot knocks for señas before declaring when its partner signed nothing', asked.includes(mate.id), `mate declared: ${mateDeclared}; phase ${state?.phase} round ${state?.roundIndex} bidder ${state?.currentBidPlayerId === mate.id ? 'mate' : state?.currentBidPlayerId === s.id ? 'host' : 'rival'} turn ${state?.currentTurnPlayerId === s.id ? 'host' : '-'} gate ${state?.readyGate?.kind ?? '-'}`)
  s.disconnect()
}

console.log(failures ? `\n${failures} failing` : '\nall rules checks pass')
process.exit(failures ? 1 : 0)
