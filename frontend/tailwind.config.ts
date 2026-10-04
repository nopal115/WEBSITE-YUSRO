import type { Config } from 'tailwindcss';

export default {
	content: ['./index.html', './src/**/*.{ts,tsx}'],
	theme: {
		extend: {
			// Nilai SDD 7.2.1 / 7.3; token yang tidak diatur SDD memakai nilai Figma.
			// Komponen tidak boleh memakai hex langsung (SDD 7.2.1).
			colors: {
				brand: {
					primary: '#0F4C5C',
					'primary-hover': '#0C3D4A',
					'primary-soft': '#E3EDF0',
					'primary-line': '#C6DCE1',
					accent: '#FFB703',
					'accent-hover': '#D99B02',
					'accent-soft': '#FFF3D6',
				},
				feedback: {
					benar: '#2F7A2B',
					'benar-hover': '#2E6A00',
					'benar-soft': '#E7F4E4',
					salah: '#C42B2B',
					'salah-hover': '#9B2020',
					'salah-soft': '#FCEBEB',
				},
				// SDD 7.3: status evaluasi. Belum ada varian soft di SDD.
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
					bg: '#FFFFFF',
					surface: '#FFFFFF',
					'surface-alt': '#FBF9F4',
					border: '#E6E0D4',
					'border-strong': '#D5DBE0',
					locked: '#E5E7EB',
				},
				text: {
					primary: '#16211D',
					secondary: '#4A5A54',
					muted: '#6A766F',
					'on-brand': '#FFFFFF',
				},
			},
			// SDD 7.2.3. rounded-full bawaan Tailwind dipakai untuk avatar/indikator bulat.
			borderRadius: { sm: '8px', md: '14px', lg: '20px' },
			// [REKOMENDASI] Bilah kemajuan tanpa persentase (unggahan rekaman): fetch tidak melaporkan kemajuan unggah.
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
				card: '0 1px 3px rgba(0,0,0,.08)',
				raised: '0 4px 12px rgba(0,0,0,.10)',
			},
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				// [TBD] LPMQ Isep Misbah adalah huruf utama menurut SDD 7.4.1, menunggu berkas font + izin.
				arabic: ['"Amiri Quran"', '"Scheherazade New"', 'Amiri', '"Noto Sans Arabic"', 'serif'],
			},
			// SDD 7.4 / 7.4.1. Caption, Button, Score, Arabic S: nilai Figma (SDD tidak mengatur).
			// Letter-spacing selain Label: rasio Figma dalam em (SDD tidak mengatur).
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
