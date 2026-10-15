/** 原型数据仅保存于当前浏览器。 */
export function readLocal<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(`okr-prototype:${key}`)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error('原型数据读取失败，请保留浏览器数据并重试')
  }
}
export function writeLocal(key: string, value: unknown) {
  localStorage.setItem(`okr-prototype:${key}`, JSON.stringify(value))
}
export function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
export function today() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
}
export function period(date = today()) {
  return { year: Number(date.slice(0, 4)), quarter: Math.ceil(Number(date.slice(5, 7)) / 3) }
}
export function quarterEnd(year: number, quarter: number) {
  return new Date(Date.UTC(year, quarter * 3, 0)).toISOString().slice(0, 10)
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  )
}
export function weekOf(value = today()) {
  if (!validDate(value)) throw new Error('请选择有效的所属周')
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  const start = date.toISOString().slice(0, 10)
  date.setUTCDate(date.getUTCDate() + 6)
  return { start, end: date.toISOString().slice(0, 10) }
}
export function stamp() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}
export function validNumber(
  value: string | number | null,
  precision: number,
  min?: number,
  max?: number
) {
  if (value === null || String(value).trim() === '') return false
  const text = String(value)
  const number = Number(text)
  return (
    /^-?\d+(\.\d+)?$/.test(text) &&
    Number.isFinite(number) &&
    (text.split('.')[1]?.length || 0) <= precision &&
    (min === undefined || number >= min) &&
    (max === undefined || number <= max)
  )
}
