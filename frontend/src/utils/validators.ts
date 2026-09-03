export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
export const isWavFile = (file: File) => file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')
