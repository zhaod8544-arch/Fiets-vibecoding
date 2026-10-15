export type MetricType = '' | 'higher' | 'lower' | 'qualitative'
export interface KeyResult {
  id: string
  description: string
  metric: string
  type: MetricType
  target: string
  actual: string
  unit: string
  standard: string
  situation: string
  progress: string
  deadline: string
}
export interface Goal {
  id: string
  year: number
  quarter: number
  name: string
  krs: KeyResult[]
  version: number
  savedAt: string
}
export type Scenario = 'success' | 'failure' | 'conflict'
export interface WorkItem {
  id: string
  date: string
  work: string
  outcome: string
  krIds: string[]
  krNames?: Record<string, string>
}
export interface Weekly {
  id: string
  start: string
  end: string
  items: WorkItem[]
  blockers: string
  plan: string
  version: number
  savedAt: string
}
export interface Recommendation {
  itemId: string
  krId: string
  description: string
  reason: string
  match: number
  source: string
}
export interface MaterialSnapshot {
  owner: string
  year: number
  quarter: number
  key: string
  goals: Goal[]
  weekly: Weekly[]
  capturedAt: string
}
export interface KrAnalysis {
  krId: string
  description: string
  match: number | null
  reason: string
  completion: string
  outcomes: string[]
  sourceIds: string[]
  gap: string
}
export interface Analysis {
  id: string
  snapshot: MaterialSnapshot
  preview: string
  suggestedScore: number | null
  scoreReason: string
  createdAt: string
  model: string
  rule: string
  details: KrAnalysis[]
  insufficient: boolean
  stage: boolean
}
export interface Review {
  updatedAt?: number
  id: string
  year: number
  quarter: number
  status: 'draft' | 'archived'
  body: string
  score: string
  reason: string
  version: number
  savedAt: string
  archiveVersion: number
  archivedAt: string
  sourceArchiveId: string
  analysis: Analysis | null
  snapshot: MaterialSnapshot | null
  outdatedAtArchive: boolean
}
