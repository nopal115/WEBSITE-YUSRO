import type { Config } from 'tailwindcss';

export default {
	content: ['./index.html', './src/**/*.{ts,tsx}'],
	theme: {
		extend: {
			colors: {
				brand: {
					primary: '#0F4C5C',
					'primary-hover': '#0B3B47',
					'primary-soft': '#E3EDF0',
					'primary-line': '#C6DCE1',
					accent: '#FFB703',
					'accent-hover': '#D99B02',
					'accent-soft': '#FFF3D6',
				},
				feedback: {
					benar: '#3D8C00',
					'benar-hover': '#2E6A00',
					'benar-soft': '#D7FFB8',
					salah: '#C42B2B',
					'salah-hover': '#9B2020',
					'salah-soft': '#FFDFE0',
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
					'surface-alt': '#F7F9FA',
					border: '#E5E7EB',
					'border-strong': '#D5DBE0',
					locked: '#E5E7EB',
				},
				text: {
					primary: '#1E293B',
					secondary: '#64748B',
					muted: '#AFB8C1',
					'on-brand': '#FFFFFF',
				},
			},
			borderRadius: { card: '14px' },
			fontFamily: { sans: ['Inter', 'sans-serif'] },
			fontSize: {
				label: ['13px', { lineHeight: '18px', letterSpacing: '0.52px', fontWeight: '700' }],
				'body-s': ['13px', { lineHeight: '20px', fontWeight: '400' }],
				caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
				display: ['var(--font-display, 32px)', { lineHeight: '1.2' }], // TODO(verifikasi Figma Dev Mode)
				h1: ['var(--font-h1, 32px)', { lineHeight: '1.2' }], // TODO(verifikasi Figma Dev Mode)
				h2: ['var(--font-h2, 28px)', { lineHeight: '1.25' }], // TODO(verifikasi Figma Dev Mode)
				h3: ['var(--font-h3, 24px)', { lineHeight: '1.3' }], // TODO(verifikasi Figma Dev Mode)
				body: ['var(--font-body, 16px)', { lineHeight: '1.5' }], // TODO(verifikasi Figma Dev Mode)
				'body-l': ['var(--font-body-l, 18px)', { lineHeight: '1.5' }], // TODO(verifikasi Figma Dev Mode)
				button: ['var(--font-button, 16px)', { lineHeight: '1.25' }], // TODO(verifikasi Figma Dev Mode)
				score: ['var(--font-score, 24px)', { lineHeight: '1.2' }], // TODO(verifikasi Figma Dev Mode)
				'arabic-xl': ['var(--font-arabic-xl, 40px)', { lineHeight: '1.4' }], // TODO(verifikasi Figma Dev Mode)
				'arabic-l': ['var(--font-arabic-l, 32px)', { lineHeight: '1.4' }], // TODO(verifikasi Figma Dev Mode)
				'arabic-m': ['var(--font-arabic-m, 24px)', { lineHeight: '1.4' }], // TODO(verifikasi Figma Dev Mode)
				'arabic-s': ['var(--font-arabic-s, 18px)', { lineHeight: '1.4' }], // TODO(verifikasi Figma Dev Mode)
			},
		},
	},
	plugins: [],
} satisfies Config;
