export const todayStr = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return todayStr(new Date(y, m - 1, d + n))
}
export const daysBetween = (from: string, to: string) => {
  const f = from.split('-').map(Number)
  const t = to.split('-').map(Number)
  return Math.round((new Date(t[0], t[1] - 1, t[2]).getTime() - new Date(f[0], f[1] - 1, f[2]).getTime()) / 86400000)
}
