import type { Novedad } from './novedades';

// Newest first. Write for players, not for us: what changed at the table, in a few short lines.
export const NOVEDADES: Novedad[] = [
  {
    id: '2026-10-04-televisores',
    date: '2026-10-04',
    title: 'Televisores en el inicio',
    items: [
      'La pantalla de inicio tiene dos televisores sobre mesitas: Ajustes y Novedades.',
      'El de Novedades se pone ámbar y pulsa cuando hay algo que no viste. Al abrirlo se calma.',
    ],
  },
  {
    id: '2026-10-04-senas',
    date: '2026-10-04',
    title: 'Señas más vivas',
    items: [
      'Los bots te miran, esperan unos segundos y recién ahí piden señas. Y solo las piden si tu respuesta puede cambiarles el pedido.',
      'Antes de pedir esperan a que termines de hacer señas, y te miran un instante cuando les llega una.',
      'Si les hacés «no», pueden explicarte con señas por qué pidieron lo que pidieron.',
      'Nuevo ajuste, «Aviso de seña vista»: tu seña destella en rojo si un rival la capta. Viene apagado.',
    ],
  },
  {
    id: '2026-10-04-giro',
    date: '2026-10-04',
    title: 'Giro del As de Copas, corregido',
    items: [
      'Cuando el As de Copas invierte el sentido, la base se lee desde el Mano en el sentido nuevo.',
      'Ya no se pierde la última carta jugada, y los empates los gana el primero leído.',
    ],
  },
  {
    id: '2026-10-03-mesa',
    date: '2026-10-03',
    title: 'La mesa, más cuidada',
    items: [
      'La carta que va ganando la base flota y su recuadro brilla.',
      'Las cartas se reparten boca abajo y el reloj de pedidos arranca un segundo después.',
      'El Pie pide una base menos o una más que las de la ronda. La regla anterior quedó como «Pedido del Pie: Amplia».',
      'Nuevo ajuste, «Bordes suaves», para ver nítidos los televisores, el anotador y el reloj. Viene apagado.',
    ],
  },
];
