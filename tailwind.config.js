/** Configuration Tailwind de l'espace de gestion. Régénérer css/style.css : voir README.md */
const path = require('path');
module.exports = {
  content: [path.join(__dirname, 'index.html'), path.join(__dirname, 'js/**/*.js')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FAF6F0', 100: '#F5ECE0', 200: '#EBD8C3', 300: '#D9BE9F', 400: '#C49D79',
          500: '#A97B55', 600: '#8A5C39', 700: '#6B4226', 800: '#4F2D17', 900: '#341A0B', 950: '#1F0D04'
        },
        terracotta: { DEFAULT: '#C15C3D', light: '#E27D5F', dark: '#9E3F23' },
        gold: { DEFAULT: '#D4AF37', light: '#F3E5AB' }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      }
    }
  }
};
