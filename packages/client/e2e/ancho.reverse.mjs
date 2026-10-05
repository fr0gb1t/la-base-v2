// The ancho de espadas with the As de Copas reversing the base, played for real against the server by 6 sockets
// (turns, the reversal, the skip to whoever has not played yet, the base's winner). Needs the server with
// LABASE_TEST=1 on :3100. Usage: node e2e/ancho.reverse.mjs
import { io } from 'socket.io-client'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ROLES = ['jorgito', 'alvaro', 'pepe', 'franco', 'irma', 'dulcinea'] // in play order from the Mano (antihorario)
const SCEN = {
  1: { jorgito: { suit: 'oros', value: 12 }, alvaro: { suit: 'copas', value: 7 }, pepe: { suit: 'espadas', value: 1 }, franco: { suit: 'bastos', value: 1 }, irma: { suit: 'copas', value: 1 }, dulcinea: { suit: 'oros', value: 10 } },
  2: { jorgito: { suit: 'oros', value: 2 }, alvaro: { suit: 'espadas', value: 1 }, pepe: { suit: 'bastos', value: 1 }, franco: { suit: 'oros', value: 1 }, irma: { suit: 'copas', value: 1 }, dulcinea: { suit: 'copas', value: 2 } },
}
async function run(which, invert) {
  const socks = []
  for (let i = 0; i < 6; i++) {
    const s = io('http://localhost:3100', { transports: ['websocket'], forceNew: true })
    await new Promise((r) => s.on('connect', r))
    socks.push({ s, emit: (e, p) => new Promise((r) => s.emit(e, p, r)), state: null, hand: [] })
  }
  const host = socks[0]
  const code = (await host.emit('room:create', { playerName: 'p0', playerCount: 6 })).roomCode
  for (let i = 1; i < 6; i++) await socks[i].emit('room:join', { roomCode: code, playerName: `p${i}` })
  for (let i = 0; i < 6; i++) socks[i].s.emit('player:selectTeam', { roomCode: code, playerId: socks[i].s.id, teamChoice: i % 2 ? 'ellos' : 'nosotros' })
  await sleep(300)
  await host.emit('game:config', { roomCode: code, structure: 'clasica', acePowers: { espadas: true, copas: true, oros: true }, kamikazesPerTeam: 0, bidClockMs: 0 })
  let role = null
  const log = []
  let resolved = null
  for (const k of socks) {
    k.s.on('player:hand', ({ hand }) => (k.hand = hand))
    k.s.on('game:baseResolved', (d) => (resolved = resolved ?? d))
    k.s.on('game:cardPlayed', (d) => k === host && log.push(`${role?.[d.playerId]}:${d.card.value}${d.card.suit[0]}`))
    k.s.on('game:state', async (st) => {
      k.state = st
      const me = k.s.id
      if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === me && !st.initialDraw.completed) await k.emit('draw:initialCard', { roomCode: code })
      if (st.phase === 'bidding' && st.currentBidPlayerId === me && !k.bidding) {
        k.bidding = true
        const max = st.structureSequence[st.roundIndex]
        for (let v = 0; v <= max; v++) {
          const r = await k.emit('bid:declare', { roomCode: code, bidValue: v, isKamikaze: false })
          if (r?.success) break
        }
        k.bidding = false
      }
    })
  }
  await host.emit('game:start', { roomCode: code })
  for (let i = 0; i < 300 && host.state?.phase !== 'playing'; i++) await sleep(100)
  if (host.state?.phase !== 'playing') throw new Error('never reached playing: ' + host.state?.phase)
  const st = host.state
  const rig = await host.emit('test:rig', { roomCode: code, hands: {} })
  const seatIds = rig.order.map((o) => o.id)
  const mano = st.currentManoPlayerId
  role = {}
  for (let k = 0, idx = seatIds.indexOf(mano); k < 6; k++, idx = (idx - 1 + 6) % 6) role[seatIds[idx]] = ROLES[k]
  const teamOf = Object.fromEntries(rig.order.map((o) => [o.id, o.team]))
  const hands = Object.fromEntries(seatIds.map((id) => [id, [SCEN[which][role[id]]]]))
  await host.emit('test:rig', { roomCode: code, hands })
  await sleep(300)
  for (let n = 0; n < 6; n++) {
    let turn = null
    for (let i = 0; i < 100; i++) {
      turn = host.state?.currentTurnPlayerId
      if (turn && host.state.currentBaseCards.length === n) break
      await sleep(50)
    }
    const k = socks.find((x) => x.s.id === turn)
    const card = k.hand[0]
    const r = await k.emit('card:play', { roomCode: code, card, copasDirection: card.suit === 'copas' && card.value === 1 ? (invert ? 'invertir' : 'mantener') : undefined })
    if (!r.success) throw new Error(`${role[turn]} could not play: ${r.error}`)
    await sleep(150)
  }
  for (let i = 0; i < 60 && !resolved; i++) await sleep(100)
  const w = resolved?.winnerPlayerId ?? resolved?.winnerId ?? host.state?.lastBaseWinnerPlayerId
  console.log(`ejemplo ${which} ${invert ? 'INVIERTE' : 'mantiene'} | jugado: ${log.join(' ')} | gana ${role[w]} (${teamOf[w] === teamOf[mano] ? 'nosotros' : 'ellos'})`)
  socks.forEach((k) => k.s.disconnect())
  return role[w]
}
const r = [await run(1, true), await run(1, false), await run(2, true), await run(2, false)]
const want = ['pepe', 'franco', 'alvaro', 'pepe']
console.log(r.every((x, i) => x === want[i]) ? 'PASS' : `FAIL: got ${r} want ${want}`)
process.exit(0)
