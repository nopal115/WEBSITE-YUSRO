export const formatPercent = (value: number) => `${Math.round(value)}%`
export const formatDate = (value: string) => new Intl.DateTimeFormat('id-ID').format(new Date(value))
