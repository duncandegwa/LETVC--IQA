/** Laikipia East TVC design tokens — see docs/ARCHITECTURE.md and
 * frontend/src/styles/theme.css for the full rationale. Deliberately not
 * Tailwind's default palette: olive/gold/graphite are the college's own
 * colors, and the type scale pairs a collegiate serif with a clean
 * data-dense sans so dashboards stay legible at high information density. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        olive: { 50: '#f2f4ec', 100: '#dfe6cb', 300: '#9fae6e', 500: '#5c6b2f', 600: '#4a5625', 700: '#39421c', 900: '#232817' },
        gold: { 50: '#fbf6e6', 100: '#f2e2ab', 300: '#dfbb4e', 500: '#c9a227', 600: '#a3811c', 700: '#7a6115' },
        graphite: { 50: '#f4f4f4', 100: '#e2e2e3', 300: '#9a9a9c', 500: '#4a4a4d', 700: '#2b2b2e', 900: '#161618' },
        clay: { 500: '#b5502f', 600: '#943f24' }, // returned/rejected accent — warm, not alarmist
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
