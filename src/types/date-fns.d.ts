declare module 'date-fns' {
  export function format(date: Date | number, format: string): string;
  export function startOfWeek(date: Date | number, options?: any): Date;
  export function endOfWeek(date: Date | number, options?: any): Date;
  export function addWeeks(date: Date | number, amount: number): Date;
  export function subWeeks(date: Date | number, amount: number): Date;
  export function addDays(date: Date | number, amount: number): Date;
  export function subDays(date: Date | number, amount: number): Date;
  export function startOfMonth(date: Date | number): Date;
  export function endOfMonth(date: Date | number): Date;
  export function addMonths(date: Date | number, amount: number): Date;
  export function subMonths(date: Date | number, amount: number): Date;
  export function getDay(date: Date | number): number;
  export function getMonth(date: Date | number): number;
  export function getYear(date: Date | number): number;
  export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean;
  export function isSameMonth(dateLeft: Date | number, dateRight: Date | number): boolean;
  export function isToday(date: Date | number): boolean;
  export function parseISO(string: string): Date;
  export function differenceInDays(dateLeft: Date | number, dateRight: Date | number): number;
}

declare module 'date-fns/locale' {
  export const ko: any;
  export const enUS: any;
  export const ja: any;
}