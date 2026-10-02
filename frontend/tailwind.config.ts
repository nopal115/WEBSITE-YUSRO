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
					processing: '#B5820A',
					failed: '#8A5A2B',
				},
				semantic: {
					info: '#1B87BD',
					'info-soft': '#E1F1F8',
					warning: '#B5820A',
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
					muted: '#6E7A73',
					'on-brand': '#FFFFFF',
				},
			},
			borderRadius: { card: '14px' },
			fontFamily: { sans: ['Inter', 'sans-serif'], arabic: ['Amiri Quran', 'serif'] },
			fontSize: {
				label: ['13px', { lineHeight: '18px', letterSpacing: '0.52px', fontWeight: '700' }],
				'body-s': ['13px', { lineHeight: '20px', fontWeight: '400' }],
				caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
				display: ['34px', { lineHeight: '44px', letterSpacing: '-0.544px', fontWeight: '700' }],
				h1: ['28px', { lineHeight: '36px', letterSpacing: '-0.336px', fontWeight: '700' }],
				h2: ['22px', { lineHeight: '30px', letterSpacing: '-0.176px', fontWeight: '700' }],
				h3: ['18px', { lineHeight: '26px', letterSpacing: '-0.072px', fontWeight: '600' }],
				body: ['15px', { lineHeight: '24px', fontWeight: '400' }],
				'body-l': ['17px', { lineHeight: '28px', fontWeight: '400' }],
				button: ['16px', { lineHeight: '20px', letterSpacing: '0.8px', fontWeight: '700' }],
				score: ['56px', { lineHeight: '64px', letterSpacing: '-1.12px', fontWeight: '700' }],
				'arabic-xl': ['var(--font-arabic-xl, 40px)', { lineHeight: '1.4' }], // TODO(verifikasi Figma Dev Mode)
				'arabic-l': ['var(--font-arabic-l, 32px)', { lineHeight: '1.4' }], // TODO(verifikasi Figma Dev Mode)
				'arabic-m': ['32px', { lineHeight: '64px', fontWeight: '400' }],
				'arabic-s': ['24px', { lineHeight: '50px', fontWeight: '400' }],
			},
		},
	},
	plugins: [],
} satisfies Config;
