/** @type {import('tailwindcss').Config} */
// La Base v2: the default Tailwind scales used by the lobby/room/config screens are remapped to the
// 3D table's palette (src/table3d/look.ts), so every screen shares the same dark tabletop look
// without rewriting each component. slate/zinc/gray → soot→bone, emerald → brass/olive felt,
// blue → Loop Hero teal (Nosotros), rose/red → oxblood/rose (Ellos), yellow/orange → old gold/amber.
const soot = {
  50: '#f3eee2', 100: '#e6ddc8', 200: '#d8c7a0', 300: '#bfae8c', 400: '#9a8b70', 500: '#756a57',
  600: '#544b3e', 700: '#3a332b', 800: '#26211c', 900: '#1c1714', 950: '#0b0908',
}
const olive = {
  50: '#f4f5e6', 100: '#e4e8c4', 200: '#cfd69a', 300: '#b9c273', 400: '#9fa956', 500: '#879b42',
  600: '#6b7a34', 700: '#535f29', 800: '#3d461f', 900: '#2d2c18', 950: '#1a1a0e',
}
const teal = {
  50: '#eef6f7', 100: '#d7e9ec', 200: '#bcd6db', 300: '#a4bec1', 400: '#7fb0ba', 500: '#5ea2b0',
  600: '#4f7f8a', 700: '#3d6470', 800: '#2c4a53', 900: '#1d2f35', 950: '#0f1b1f',
}
const blood = {
  50: '#f7ecea', 100: '#ecd2cd', 200: '#e0b3ab', 300: '#d99a8f', 400: '#c46a5c', 500: '#a8412f',
  600: '#8e2a22', 700: '#602217', 800: '#4a1812', 900: '#33100c', 950: '#1a0606',
}
const rose = {
  50: '#f8eeee', 100: '#efd8d8', 200: '#e3bcbc', 300: '#d6a3a3', 400: '#b76d6e', 500: '#9e5556',
  600: '#8a4546', 700: '#7a3a3b', 800: '#5a2a2b', 900: '#3a1a1b', 950: '#240a0b',
}
const gold = {
  50: '#faf5e6', 100: '#f2e6c2', 200: '#ead594', 300: '#e3c77a', 400: '#d6b25a', 500: '#c9a043',
  600: '#a88232', 700: '#846425', 800: '#5f471a', 900: '#3d2e11', 950: '#2a2009',
}
const amber = {
  50: '#fbf1e4', 100: '#f5dcbd', 200: '#eec293', 300: '#e6a86a', 400: '#d98e45', 500: '#c97a33',
  600: '#b8742a', 700: '#8f561c', 800: '#6a3f14', 900: '#45280c', 950: '#2a1706',
}
const plum = {
  50: '#f4edf4', 100: '#e2d0e1', 200: '#c9a8c7', 300: '#ad7fab', 400: '#8f5d8d', 500: '#724470',
  600: '#5c355a', 700: '#472246', 800: '#361934', 900: '#251124', 950: '#150914',
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        white: '#efe6d0',
        black: '#0b0908',
        slate: soot,
        zinc: soot,
        gray: soot,
        neutral: soot,
        stone: soot,
        emerald: olive,
        green: olive,
        lime: olive,
        blue: teal,
        cyan: teal,
        sky: teal,
        indigo: teal,
        red: blood,
        rose,
        pink: rose,
        yellow: gold,
        orange: amber,
        amber,
        purple: plum,
        violet: plum,
        fuchsia: plum,
      },
      fontFamily: {
        sans: ['"IM Fell English"', 'Georgia', 'serif'],
        serif: ['"IM Fell English"', 'Georgia', 'serif'],
        mono: ['VT323', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '2px',
        md: '2px',
        lg: '3px',
        xl: '3px',
        '2xl': '4px',
      },
    },
  },
  plugins: [],
}
