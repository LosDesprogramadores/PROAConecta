/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
    "./node_modules/flowbite/**/*.js"
  ],
  theme: {
    extend: {
      // ===== COLORES PERSONALIZADOS =====
      colors: {
        primary: {
          50: '#E6F1FB',
          100: '#B5D4F4',
          200: '#85B7EB',
          400: '#378ADD',
          500: '#2678C8',
          600: '#185FA5',
          700: '#0C447C',
          800: '#08335C',
          900: '#042C53'
        },
        secondary: {
          50: '#F1EFE8',
          100: '#D3D1C7',
          200: '#B4B2A9',
          400: '#888780',
          600: '#5F5E5A',
          700: '#444441',
          900: '#2C2C2A'
        },
        accent: {
          50: '#EEEDFE',
          100: '#CECBF6',
          200: '#AFA9EC',
          400: '#7F77DD',
          600: '#534AB7',
          700: '#3C3489',
          900: '#26215C'
        },
        success: {
          50: '#EAF3DE',
          100: '#C0DD97',
          200: '#97C459',
          400: '#639922',
          600: '#3B6D11',
          700: '#27500A',
          900: '#173404'
        },
        warning: {
          50: '#FAEEDA',
          100: '#FAC775',
          200: '#EF9F27',
          400: '#BA7517',
          600: '#854F0B',
          700: '#633806',
          900: '#412402'
        },
        danger: {
          50: '#FCEBEB',
          100: '#F7C1C1',
          200: '#F09595',
          400: '#E24B4A',
          600: '#A32D2D',
          700: '#791F1F',
          900: '#501313'
        }
      },

      // ===== ESPACIADO CONSISTENTE =====
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        xxl: '32px',
        '3xl': '48px'
      },

      // ===== TIPOGRAFÍA =====
      fontSize: {
        xs: ['11px', { lineHeight: '1.4' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['14px', { lineHeight: '1.6' }],
        lg: ['16px', { lineHeight: '1.7' }],
        xl: ['18px', { lineHeight: '1.7' }],
        '2xl': ['20px', { lineHeight: '1.8' }],
        '3xl': ['24px', { lineHeight: '1.8' }],
        '4xl': ['28px', { lineHeight: '1.9' }]
      },

      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        mono: ['"Roboto Mono"', 'monospace']
      },

      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700'
      },

      // ===== BORDER RADIUS =====
      borderRadius: {
        none: '0',
        sm: '4px',
        base: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px'
      },

      // ===== TRANSICIONES Y ANIMACIONES =====
      transition: {
        fast: 'all 150ms ease-out',
        base: 'all 200ms ease-out',
        slow: 'all 300ms ease-out'
      },

      transitionDuration: {
        150: '150ms',
        200: '200ms',
        300: '300ms'
      },

      // ===== SOMBRAS PERSONALIZADAS =====
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.08)',
        base: '0 2px 4px 0 rgba(0, 0, 0, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        md: '0 4px 8px 0 rgba(0, 0, 0, 0.08), 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        lg: '0 8px 16px 0 rgba(0, 0, 0, 0.1), 0 4px 8px 0 rgba(0, 0, 0, 0.08)',
        xl: '0 12px 24px 0 rgba(0, 0, 0, 0.12), 0 8px 16px 0 rgba(0, 0, 0, 0.08)',
        none: 'none'
      },

      // ===== Z-INDEX CONSISTENTE =====
      zIndex: {
        0: '0',
        10: '10',
        20: '20',
        30: '30',
        40: '40',
        50: '50',
        auto: 'auto',
        dropdown: '1000',
        sticky: '1020',
        fixed: '1030',
        backdrop: '1040',
        offcanvas: '1050',
        modal: '1060'
      },

      // ===== OPCIONES DEL TEMA =====
      opacity: {
        0: '0',
        5: '0.05',
        10: '0.1',
        20: '0.2',
        30: '0.3',
        40: '0.4',
        50: '0.5',
        60: '0.6',
        70: '0.7',
        80: '0.8',
        90: '0.9',
        95: '0.95',
        100: '1'
      },

      // ===== ANCHO MÁXIMO DE CONTENEDOR =====
      maxWidth: {
        xs: '320px',
        sm: '480px',
        md: '640px',
        lg: '920px',
        xl: '1200px',
        '2xl': '1400px'
      }
    }
  },

  // ===== PLUGINS =====
  plugins: [
    require('flowbite/plugin'),

    // Plugin personalizado para componentes frecuentes
    function ({ addComponents, theme }) {
      addComponents({
        // ===== BOTONES =====
        '.btn': {
          '@apply inline-flex items-center justify-center px-lg py-md rounded-md font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none': {}
        },
        '.btn-primary': {
          '@apply bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus:ring-2 focus:ring-primary-400 focus:ring-offset-2': {}
        },
        '.btn-secondary': {
          '@apply bg-secondary-100 text-secondary-700 hover:bg-secondary-200 active:bg-secondary-300 focus:ring-2 focus:ring-secondary-400 focus:ring-offset-2': {}
        },
        '.btn-ghost': {
          '@apply text-secondary-700 hover:bg-secondary-100 active:bg-secondary-200 focus:ring-2 focus:ring-secondary-400 focus:ring-offset-2': {}
        },
        '.btn-outline': {
          '@apply border-2 border-primary-600 text-primary-600 hover:bg-primary-50 active:bg-primary-100 focus:ring-2 focus:ring-primary-400 focus:ring-offset-2': {}
        },
        '.btn-danger': {
          '@apply bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 focus:ring-2 focus:ring-danger-400 focus:ring-offset-2': {}
        },
        '.btn-success': {
          '@apply bg-success-600 text-white hover:bg-success-700 active:bg-success-800 focus:ring-2 focus:ring-success-400 focus:ring-offset-2': {}
        },

        // ===== CARDS =====
        '.card': {
          '@apply bg-white rounded-lg border border-secondary-200 p-lg shadow-sm hover:shadow-md transition-all duration-200': {}
        },
        '.card-compact': {
          '@apply bg-white rounded-md border border-secondary-200 p-md shadow-xs': {}
        },
        '.card-elevated': {
          '@apply bg-white rounded-lg border border-secondary-200 p-lg shadow-md hover:shadow-lg transition-all duration-200': {}
        },

        // ===== BADGES =====
        '.badge': {
          '@apply inline-flex items-center px-md py-sm rounded-full text-xs font-medium': {}
        },
        '.badge-primary': {
          '@apply bg-primary-100 text-primary-700': {}
        },
        '.badge-success': {
          '@apply bg-success-100 text-success-700': {}
        },
        '.badge-warning': {
          '@apply bg-warning-100 text-warning-700': {}
        },
        '.badge-danger': {
          '@apply bg-danger-100 text-danger-700': {}
        },

        // ===== INPUTS =====
        '.input': {
          '@apply w-full px-lg py-md rounded-md border border-secondary-200 bg-white text-secondary-900 placeholder-secondary-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-0 focus:border-primary-400': {}
        },
        '.input-sm': {
          '@apply px-md py-sm text-sm': {}
        },

        // ===== SECCIONES Y LAYOUTS =====
        '.section': {
          '@apply py-xl px-lg': {}
        },
        '.section-lg': {
          '@apply py-3xl px-lg': {}
        },
        '.container-tight': {
          '@apply max-w-lg mx-auto': {}
        },
        '.container-default': {
          '@apply max-w-xl mx-auto': {}
        },
        '.container-wide': {
          '@apply max-w-2xl mx-auto': {}
        },

        // ===== NAVBAR =====
        '.navbar': {
          '@apply sticky top-0 z-40 w-full bg-white border-b border-secondary-200 shadow-sm': {}
        },
        '.navbar-dark': {
          '@apply bg-primary-700 border-primary-800': {}
        },

        // ===== SIDEBAR =====
        '.sidebar': {
          '@apply w-64 bg-secondary-50 border-r border-secondary-200 min-h-screen overflow-y-auto': {}
        },
        '.sidebar-item': {
          '@apply w-full text-left px-lg py-md rounded-md text-secondary-700 transition-all duration-200 hover:bg-secondary-100 active:bg-secondary-200 focus:outline-none focus:ring-2 focus:ring-primary-400': {}
        },
        '.sidebar-item-active': {
          '@apply bg-primary-50 text-primary-700 font-medium border-r-4 border-primary-600': {}
        },

        // ===== DIVIDERS =====
        '.divider': {
          '@apply border-t border-secondary-200': {}
        },
        '.divider-sm': {
          '@apply border-t border-secondary-100': {}
        }
      })
    }
  ],

  // ===== MODO OSCURO (OPCIONAL) =====
  darkMode: 'class',

  // ===== SAFELIST PARA FLOWBITE =====
  safelist: [
    {
      pattern: /^(bg|text|border|from|to|via)-(primary|secondary|accent|success|warning|danger)-(50|100|200|400|600|700|800|900)$/
    },
    {
      pattern: /^(hover|focus|active):(bg|text|border)-(primary|secondary|accent|success|warning|danger)-(50|100|200|400|600|700|800|900)$/
    },
    {
      pattern: /^ring-(primary|secondary|accent|success|warning|danger)-(400|500|600)$/
    }
  ]
}