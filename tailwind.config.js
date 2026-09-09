/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colores por tipo de circuito, usados tanto en el plano como en las tablas.
        iug: '#d97706',
        tug: '#2563eb',
        tue: '#dc2626',
      },
    },
  },
  plugins: [],
}
