import type { InspectionEvent, InspectionEventType, EventSeverity } from '@/types/inspection'

/**
 * Minimal typed event bus. The whole system is event-driven:
 * simulator → bus → decision orchestrator → bus → store → UI.
 *
 * In production this boundary maps onto MQTT topics (e.g. `line-a/cam-01/events`).
 */
export type EventListener = (event: InspectionEvent) => void

export interface EmitOptions {
  objectId?: string
  videoTime?: number
  severity?: EventSeverity
  data?: Record<string, unknown>
}

const DEFAULT_SEVERITY: Record<InspectionEventType, EventSeverity> = {
  OBJECT_ENTERED: 'info',
  OBJECT_TRACKED: 'info',
  INSPECTION_STARTED: 'info',
  CAP_CONFIDENCE: 'info',
  INSPECTION_COMPLETED: 'info',
  PASS: 'ok',
  RECHECK: 'warn',
  REJECT: 'error',
  HUMAN_REVIEW: 'warn',
  EJECT_TRIGGERED: 'error',
  ALERT: 'error',
  LINE_DECISION: 'info',
  OBJECT_EXITED: 'info',
  HUMAN_OVERRIDE: 'warn',
  SYSTEM: 'info',
}

export class EventBus {
  private listeners = new Set<EventListener>()
  private typeListeners = new Map<InspectionEventType, Set<EventListener>>()
  private seq = 0

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  on(type: InspectionEventType, listener: EventListener): () => void {
    let set = this.typeListeners.get(type)
    if (!set) {
      set = new Set()
      this.typeListeners.set(type, set)
    }
    set.add(listener)
    return () => set!.delete(listener)
  }

  emit(type: InspectionEventType, message: string, opts: EmitOptions = {}): InspectionEvent {
    const event: InspectionEvent = {
      seq: ++this.seq,
      type,
      timestamp: Date.now(),
      videoTime: opts.videoTime,
      objectId: opts.objectId,
      message,
      severity: opts.severity ?? DEFAULT_SEVERITY[type],
      data: opts.data,
    }
    this.listeners.forEach((l) => l(event))
    this.typeListeners.get(type)?.forEach((l) => l(event))
    return event
  }
}

export const eventBus = new EventBus()
