export type NotificationRow = { id: string; user_id: string; title: string; body: string; data?: Record<string, unknown> | null };
export type ExpoMessage = { to: string; title: string; body: string; sound: 'default'; data: Record<string, unknown> };
export type Ticket = { status: 'ok' | 'error'; message?: string; details?: { error?: string } };
export function chunk<T>(items: T[], size?: number): T[][];
export function buildMessages(rows: NotificationRow[], tokens: Record<string, string>): { messages: ExpoMessage[]; skipped: string[] };
export function interpretTickets(ids: string[], tickets: Ticket[]): { sent: string[]; failed: { id: string; error: string }[]; invalidTokenIds: string[] };
