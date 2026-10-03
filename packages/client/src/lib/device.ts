// Is this a touch device (a phone or tablet: the main pointer is a finger)? Everything for phones is
// gated on this, so desktop behaves exactly as it always did.
export const isTouch: boolean = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
