/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			timber: {
  				50: '#fdf8f0',
  				100: '#f5e6ce',
  				200: '#e8c99a',
  				300: '#d4a053',
  				400: '#c08a3e',
  				500: '#a67332',
  				600: '#8a5e28',
  				700: '#6e4a20',
  				800: '#533818',
  				900: '#3a2810',
  				950: '#1a1410',
  			},
  			leaf: {
  				400: '#4ade80',
  				500: '#22c55e',
  				600: '#16a34a',
  			},
  		},
  		keyframes: {
  			'float': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-6px)' },
  			},
  			'dust': {
  				'0%': { transform: 'translateY(0) translateX(0)', opacity: 0 },
  				'20%': { opacity: 0.6 },
  				'80%': { opacity: 0.4 },
  				'100%': { transform: 'translateY(-80px) translateX(20px)', opacity: 0 },
  			},
  		},
  		animation: {
  			'float': 'float 6s ease-in-out infinite',
  			'dust': 'dust 8s ease-in-out infinite',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
