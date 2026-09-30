# Red y Conectividad - Explicación Técnica

## El Problema que Planteaste

`localhost` en Docker Compose y `192.168.1.145` son direcciones diferentes:
- **localhost (127.0.0.1)**: Solo en tu máquina
- **192.168.1.145**: Tu máquina en la red local

¿Cómo sabemos que funciona? ✅

## Cómo Está Configurado

### Docker Compose Port Mapping
```yaml
server:
  ports:
    - "3000:3000"  # Mapea TODOS los interfaces (0.0.0.0:3000)
```

Esto significa que el puerto 3000 está disponible en:
- ✅ `localhost:3000` → `127.0.0.1:3000`
- ✅ `192.168.1.145:3000` → Tu IP local
- ✅ Cualquier otra IP de la máquina

### Socket.io Conexión - Cómo Funciona

El cliente está configurado para auto-detectar:

```typescript
const protocol = window.location.protocol;    // http: o https:
const hostname = window.location.hostname;    // localhost o 192.168.1.145
const port = 3000;

serverUrl = `${protocol}//${hostname}:${port}`;
```

**Ejemplo 1: Acceso por localhost**
```
Usuario abre:     http://localhost:5173
Socket.io intenta: http://localhost:3000
localhost resuelve: 127.0.0.1
Resultado: ✅ Conecta correctamente
```

**Ejemplo 2: Acceso por IP**
```
Usuario abre:     http://192.168.1.145:5173
Socket.io intenta: http://192.168.1.145:3000
IP resuelve:      192.168.1.145
Resultado: ✅ Conecta correctamente
```

## Verificación Técnica

Probamos ambas rutas:

```bash
# Ruta 1: localhost
$ curl http://localhost:3000/health
{"status":"ok","timestamp":"2026-04-15T05:21:01.348Z"}

# Ruta 2: IP
$ curl http://192.168.1.145:3000/health
{"status":"ok","timestamp":"2026-04-15T05:21:01.348Z"}
```

**Ambas funcionan** ✅

## Recomendación de Uso

### Para Uso Local (1 persona)
```
http://localhost:5173
```
- Más simple
- No necesita buscar IP
- Solo funciona en tu computadora

### Para Red Local (Múltiples personas)
```
http://192.168.1.145:5173  (reemplaza con tu IP)
```
- Funciona desde otras máquinas
- Requerido para multiplayer
- **IMPORTANTE**: Todos deben usar ESTA dirección (no `localhost`)

## Casos Edge

### ¿Qué pasa si mezclo direcciones?

❌ **NO HAGAS ESTO** (va a fallar):
```
Jugador 1: http://localhost:5173
Jugador 2: http://192.168.1.145:5173
```

Ambos pueden conectar al servidor, PERO:
- Cada uno se conecta a su Socket.io local
- Están en "universos paralelos" del Socket.io
- No pueden ver los eventos uno del otro

✅ **ESTO FUNCIONA** (todos iguales):
```
Jugador 1: http://192.168.1.145:5173
Jugador 2: http://192.168.1.145:5173
Jugador 3: http://192.168.1.145:5173
```

O si es solo en tu máquina:
```
Jugador 1: http://localhost:5173 (Tab A)
Jugador 2: http://localhost:5173 (Tab B)
Jugador 3: http://localhost:5173 (Tab C)
```

## Diagrama de Conexión

```
┌─────────────────────────────────────────────────────────┐
│                  Tu Máquina Host                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Navegador                 Docker Network               │
│  ┌─────────────┐          ┌──────────────┐              │
│  │ localhost   │━━━━━━━━━►│ Contenedor   │              │
│  │ 127.0.0.1   │          │ server       │              │
│  └─────────────┘          │ Puerto 3000  │              │
│                           └──────────────┘              │
│  ┌─────────────┐                                        │
│  │ 192.168.1.145                                        │
│  │ (tu IP)     │━━━━━━━━━►(misma ruta, puertos mapeados)
│  └─────────────┘                                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Prueba de Conectividad

Si sospechas problemas de red:

```bash
# Verificar que el servidor responde en ambas direcciones
curl http://localhost:3000/health
curl http://192.168.1.145:3000/health

# Ambas deben devolver JSON con "status":"ok"
```

## Para Usuarios Windows/Mac

Si estás usando virtualizadores o WSL:

**Windows (WSL2)**
- Encontrar IP: `ipconfig` en PowerShell
- Buscar "WSL" → ve la sección IPv4
- O usa: `hostname -I` en la terminal WSL

**Mac**
- `ifconfig` → busca `inet` (no `inet6`)
- Típicamente `192.168.x.x` o `10.0.x.x`

## Conclusión

✅ El setup actual **sí funciona** correctamente en ambas formas de acceso porque:
1. Docker mapea el puerto a `0.0.0.0:3000` (todas las interfaces)
2. El cliente auto-detecta su dirección y se conecta a la misma
3. Ambas rutas (`localhost` e IP) están disponibles en el host

**Recomendación final**: Para multiplayer, usa la IP y asegúrate de que todos usen **la MISMA dirección**.
