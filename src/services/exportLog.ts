import type { InspectionEvent, InspectionRecord } from '@/types/inspection'

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

export function exportEventsJson(events: InspectionEvent[], records: InspectionRecord[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    system: 'JEV Visual Inspection Prototype',
    events: events.map((e) => ({ ...e, timestamp: new Date(e.timestamp).toISOString() })),
    inspections: records,
  }
  download(`jev-inspection-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json')
}

function csvEscape(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportEventsCsv(events: InspectionEvent[]) {
  const header = ['seq', 'timestamp', 'video_time', 'type', 'object_id', 'severity', 'message']
  const rows = events.map((e) => [
    e.seq,
    new Date(e.timestamp).toISOString(),
    e.videoTime?.toFixed(3) ?? '',
    e.type,
    e.objectId ?? '',
    e.severity,
    e.message,
  ])
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
  download(`jev-events-${stamp()}.csv`, csv, 'text/csv')
}

export function exportInspectionsCsv(records: InspectionRecord[]) {
  const header = [
    'timestamp',
    'object_id',
    'object_confidence',
    'attribute_confidence',
    'alignment',
    'decision',
    'decision_confidence',
    'reason',
    'engine',
    'action',
    'latency_ms',
    'human_override',
  ]
  const rows = records.map((r) => [
    r.timestamp,
    r.objectId,
    r.vision.object.toFixed(3),
    r.vision.attribute.toFixed(3),
    r.vision.alignment.toFixed(3),
    r.decision.result,
    r.decision.confidence.toFixed(3),
    r.decision.reason,
    r.decision.engine,
    r.action,
    r.latencyMs.toFixed(1),
    r.humanOverride ?? '',
  ])
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
  download(`jev-inspections-${stamp()}.csv`, csv, 'text/csv')
}
