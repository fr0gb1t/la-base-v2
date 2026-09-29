// Fill a room with bots that play for real (declare, play, feint with the arm, look around).
// Usage: node e2e/bots.mjs <ROOM_CODE> [count=3] [server=http://localhost:3000]
import { io } from 'socket.io-client'

const [, , code, countArg = '3', server = 'http://localhost:3000'] = process.argv
if (!code) {
  console.error('Uso: node e2e/bots.mjs <CODIGO_DE_SALA> [cantidad=3]')
  process.exit(1)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const NAMES = ['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Fede', 'Gabi']

function bot(name) {
  const s = io(server, { transports: ['websocket'] })
  const b = { name, s, id: null, room: code.toUpperCase(), hand: [], state: null, busy: false, yaw: 0 }
  const emit = (ev, payload) => new Promise((r) => s.emit(ev, payload, r))
  s.on('connect', async () => {
    b.id = s.id
    const res = await emit('room:join', { roomCode: b.room, playerName: name })
    console.log(name, res.success ? 'entró a la sala' : `no pudo entrar: ${res.error}`)
  })
  s.on('player:hand', ({ hand }) => (b.hand = hand))
  s.on('game:state', (st) => {
    b.state = st
    void act()
  })
  s.on('game:gameOver', (d) => console.log(name, 'fin de partida — ganó', d.winner))
  setInterval(() => {
    b.yaw = Math.max(-0.9, Math.min(0.9, b.yaw + (Math.random() - 0.5) * 0.4))
    s.emit('presence:look', { roomCode: b.room, yaw: b.yaw, pitch: -0.2 + Math.random() * 0.2 })
  }, 250)

  async function act() {
    const st = b.state
    if (!st || b.busy) return
    b.busy = true
    try {
      if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === b.id && !st.initialDraw.completed) {
        await sleep(900)
        await emit('draw:initialCard', { roomCode: b.room })
      } else if (st.phase === 'bidding' && st.currentBidPlayerId === b.id) {
        await sleep(1200)
        const max = st.structureSequence[st.roundIndex]
        const opts = Array.from({ length: max + 1 }, (_, v) => v).filter((v) => st.bids.length === 0 || st.bids[0].value + v !== max)
        const v = opts[Math.floor(Math.random() * opts.length)]
        s.emit('bid:bidValueChanged', { roomCode: b.room, bidValue: v, playerId: b.id })
        await sleep(700)
        await emit('bid:declare', { roomCode: b.room, bidValue: v, isKamikaze: false })
      } else if (st.phase === 'playing' && st.currentTurnPlayerId === b.id && b.hand.length) {
        await sleep(900)
        const k = Math.floor(Math.random() * b.hand.length)
        const card = b.hand[k]
        const feint = Math.random() < 0.4
        for (let i = 0; i <= 14; i++) {
          const fwd = -0.35 + (feint ? Math.sin((i / 14) * Math.PI) * 0.55 : (i / 14) * 0.59)
          s.emit('presence:arm', { roomCode: b.room, slot: k, fwd, lat: 0, holding: true })
          await sleep(70)
        }
        if (feint) {
          s.emit('presence:arm', { roomCode: b.room, slot: k, fwd: -0.35, lat: 0, holding: false })
          await sleep(900)
        }
        const copasDirection = card.suit === 'copas' && card.value === 1 ? (Math.random() < 0.5 ? 'invertir' : 'mantener') : undefined
        await emit('card:play', { roomCode: b.room, card, copasDirection })
        if (!feint) s.emit('presence:arm', { roomCode: b.room, slot: k, fwd: 0.24, lat: 0, holding: false })
      } else if (st.pendingOrosChoice?.chooserPlayerId === b.id) {
        await sleep(900)
        await emit('ace:oros:choose', { roomCode: b.room, playerId: st.pendingOrosChoice.options[0] })
      }
    } finally {
      b.busy = false
    }
    if (b.state !== st) void act()
  }
}

for (let i = 0; i < Number(countArg); i++) {
  bot(NAMES[i % NAMES.length])
  await sleep(400)
}
console.log('Bots listos. Ctrl+C para sacarlos.')
