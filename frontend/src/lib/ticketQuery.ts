export type TicketQueryParseResult = {
  freeText: string;
  status?: string[];
  priority?: string[];
  assignedTo?: 'me' | 'unassigned' | string[];
  createdBy?: 'me' | string[];
  dateFrom?: Date | null;
  dateTo?: Date | null;
};

const statusMap: Record<string, string> = {
  open: 'OPEN',
  'açık': 'OPEN',
  in_progress: 'IN_PROGRESS',
  inprogress: 'IN_PROGRESS',
  'işlemde': 'IN_PROGRESS',
  resolved: 'RESOLVED',
  'çözüldü': 'RESOLVED',
  closed: 'CLOSED',
  'kapalı': 'CLOSED'
};

const priorityMap: Record<string, string> = {
  low: 'LOW',
  'düşük': 'LOW',
  medium: 'MEDIUM',
  orta: 'MEDIUM',
  high: 'HIGH',
  yüksek: 'HIGH',
  urgent: 'URGENT',
  acil: 'URGENT'
};

function normalizeToken(s: string) {
  return s.trim().toLowerCase();
}

function parseDateISO(s: string): Date | null {
  // expects YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00.000Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseTicketQuery(input: string): TicketQueryParseResult {
  const parts = input.split(/\s+/).filter(Boolean);
  const free: string[] = [];

  let status: string[] | undefined;
  let priority: string[] | undefined;
  let assignedTo: TicketQueryParseResult['assignedTo'];
  let createdBy: TicketQueryParseResult['createdBy'];
  let dateFrom: Date | null | undefined;
  let dateTo: Date | null | undefined;

  for (const raw of parts) {
    const idx = raw.indexOf(':');
    if (idx === -1) {
      free.push(raw);
      continue;
    }

    const key = normalizeToken(raw.slice(0, idx));
    const valueRaw = raw.slice(idx + 1);
    const value = normalizeToken(valueRaw);
    if (!value) continue;

    if (key === 'status') {
      const vals = value.split(',').map(normalizeToken).filter(Boolean);
      const mapped = vals.map((v) => statusMap[v] ?? v.toUpperCase());
      status = Array.from(new Set(mapped));
      continue;
    }

    if (key === 'priority') {
      const vals = value.split(',').map(normalizeToken).filter(Boolean);
      const mapped = vals.map((v) => priorityMap[v] ?? v.toUpperCase());
      priority = Array.from(new Set(mapped));
      continue;
    }

    if (key === 'assignee' || key === 'assignedto' || key === 'atanan') {
      if (value === 'me' || value === 'ben') {
        assignedTo = 'me';
      } else if (value === 'unassigned' || value === 'none' || value === 'null' || value === 'atanmamis' || value === 'atanmamış') {
        assignedTo = 'unassigned';
      } else {
        const ids = value.split(',').map((x) => x.trim()).filter(Boolean);
        assignedTo = ids.length ? ids : undefined;
      }
      continue;
    }

    if (key === 'createdby' || key === 'creator' || key === 'oluşturan' || key === 'olusturan') {
      if (value === 'me' || value === 'ben') {
        createdBy = 'me';
      } else {
        const ids = value.split(',').map((x) => x.trim()).filter(Boolean);
        createdBy = ids.length ? ids : undefined;
      }
      continue;
    }

    if (key === 'date') {
      // date:YYYY-MM-DD..YYYY-MM-DD
      const [fromS, toS] = valueRaw.split('..');
      const from = fromS ? parseDateISO(fromS.trim()) : null;
      const to = toS ? parseDateISO(toS.trim()) : null;
      if (from) dateFrom = from;
      if (to) dateTo = to;
      continue;
    }

    if (key === 'from' || key === 'datefrom') {
      const d = parseDateISO(valueRaw.trim());
      if (d) dateFrom = d;
      continue;
    }

    if (key === 'to' || key === 'dateto') {
      const d = parseDateISO(valueRaw.trim());
      if (d) dateTo = d;
      continue;
    }

    // unknown key -> treat as free text so user doesn't lose input
    free.push(raw);
  }

  return {
    freeText: free.join(' '),
    status,
    priority,
    assignedTo,
    createdBy,
    dateFrom: dateFrom ?? null,
    dateTo: dateTo ?? null
  };
}


