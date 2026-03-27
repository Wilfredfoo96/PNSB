import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format YYYY-MM-DD (ISO) to DD/MM/YYYY for display in forms */
export function formatISODateToDDMMYYYY(iso: string): string {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.split(/[-T]/)
  if (!y || !m || !d) return iso
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
}

/** Parse DD/MM/YYYY or D/M/YY (with / or - or .) to YYYY-MM-DD for API, or return null if invalid */
export function parseDDMMYYYYToISO(str: string): string | null {
  if (typeof str !== 'string') return null
  const cleaned = str.trim().replace(/\s/g, '')
  if (cleaned === '') return null
  const parts = cleaned.split(/[\/\-.]/)
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const day = parseInt(d, 10)
  const month = parseInt(m, 10)
  const year = parseInt(y, 10)
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null
  const fullYear = year < 100 ? 2000 + year : year >= 1000 ? year : 2000 + year
  if (fullYear < 1900 || fullYear > 2100) return null
  const monthPadded = String(month).padStart(2, '0')
  const dayPadded = String(day).padStart(2, '0')
  const date = new Date(fullYear, month - 1, day)
  if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${fullYear}-${monthPadded}-${dayPadded}`
}
