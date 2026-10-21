import type { Config } from 'tailwindcss';

export default {
	darkMode: 'class',
	content: ['./index.html', './src/**/*.{ts,tsx}'],
	theme: {
		extend: {
			// Nilai SDD 7.2.1 / 7.3; token terhubung dengan CSS variables untuk dukungan Light & Dark Mode.
			colors: {
				brand: {
					primary: 'rgb(var(--color-brand-primary) / <alpha-value>)',
					'primary-hover': 'rgb(var(--color-brand-primary-hover) / <alpha-value>)',
					'primary-soft': 'rgb(var(--color-brand-primary-soft) / <alpha-value>)',
					'primary-line': 'rgb(var(--color-brand-primary-line) / <alpha-value>)',
					accent: 'rgb(var(--color-brand-accent) / <alpha-value>)',
					'accent-hover': 'rgb(var(--color-brand-accent-hover) / <alpha-value>)',
					'accent-soft': 'rgb(var(--color-brand-accent-soft) / <alpha-value>)',
				},
				feedback: {
					benar: 'rgb(var(--color-feedback-benar) / <alpha-value>)',
					'benar-hover': 'rgb(var(--color-feedback-benar-hover) / <alpha-value>)',
					'benar-soft': 'rgb(var(--color-feedback-benar-soft) / <alpha-value>)',
					salah: 'rgb(var(--color-feedback-salah) / <alpha-value>)',
					'salah-hover': 'rgb(var(--color-feedback-salah-hover) / <alpha-value>)',
					'salah-soft': 'rgb(var(--color-feedback-salah-soft) / <alpha-value>)',
				},
				// SDD 7.3: status evaluasi.
				state: {
					processing: '#906708',
					failed: '#8A5A2B',
				},
				semantic: {
					info: '#1B87BD',
					'info-soft': '#E1F1F8',
					warning: '#906708',
					'warning-soft': '#FBF1D9',
				},
				neutral: {
					bg: 'rgb(var(--color-neutral-bg) / <alpha-value>)',
					surface: 'rgb(var(--color-neutral-surface) / <alpha-value>)',
					'surface-alt': 'rgb(var(--color-neutral-surface-alt) / <alpha-value>)',
					border: 'rgb(var(--color-neutral-border) / <alpha-value>)',
					'border-strong': 'rgb(var(--color-neutral-border-strong) / <alpha-value>)',
					locked: 'rgb(var(--color-neutral-locked) / <alpha-value>)',
				},
				text: {
					primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
					secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
					muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
					'on-brand': 'rgb(var(--color-text-on-brand) / <alpha-value>)',
				},
			},
			// SDD 7.2.3. rounded-full bawaan Tailwind dipakai untuk avatar/indikator bulat.
			borderRadius: { sm: '8px', md: '14px', lg: '20px' },
			// Bilah kemajuan tanpa persentase (unggahan rekaman).
			keyframes: {
				indeterminate: {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(250%)' },
				},
			},
			animation: {
				indeterminate: 'indeterminate 1.4s ease-in-out infinite',
			},
			boxShadow: {
				card: '0 1px 3px rgba(0,0,0,.15)',
				raised: '0 4px 12px rgba(0,0,0,.20)',
			},
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				arabic: ['"Amiri Quran"', '"Scheherazade New"', 'Amiri', '"Noto Sans Arabic"', 'serif'],
			},
			fontSize: {
				display: ['40px', { lineHeight: '48px', letterSpacing: '-0.016em', fontWeight: '700' }],
				h1: ['32px', { lineHeight: '40px', letterSpacing: '-0.012em', fontWeight: '700' }],
				h2: ['24px', { lineHeight: '32px', letterSpacing: '-0.008em', fontWeight: '600' }],
				h3: ['18px', { lineHeight: '26px', letterSpacing: '-0.004em', fontWeight: '600' }],
				'body-l': ['17px', { lineHeight: '28px', letterSpacing: '0', fontWeight: '400' }],
				body: ['15px', { lineHeight: '24px', letterSpacing: '0', fontWeight: '400' }],
				'body-s': ['13px', { lineHeight: '20px', letterSpacing: '0', fontWeight: '400' }],
				label: ['11px', { lineHeight: '16px', letterSpacing: '0.12em', fontWeight: '500' }],
				caption: ['12px', { lineHeight: '16px', letterSpacing: '0', fontWeight: '400' }],
				button: ['16px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '700' }],
				score: ['56px', { lineHeight: '64px', letterSpacing: '-0.02em', fontWeight: '700' }],
				'arabic-xl': ['76px', { lineHeight: '132px', fontWeight: '400' }],
				'arabic-l': ['52px', { lineHeight: '98px', fontWeight: '400' }],
				'arabic-m': ['34px', { lineHeight: '70px', fontWeight: '400' }],
				'arabic-s': ['24px', { lineHeight: '50px', fontWeight: '400' }],
			},
		},
	},
	plugins: [],
} satisfies Config;
