import type { components } from './generated'

type S = components['schemas']

export type Meta = S['MetaResponse']
export type MetaConfig = S['MetaConfig']
export type StudentStatus = S['StatusResponse']
export type Summary = S['SummaryResponse']
export type HistoryItem = S['HistoryItem']
export type HistoryPage = S['HistoryResponse']
export type Trajectory = S['TrajectoryResponse']
export type TrajectoryStep = S['TrajectoryStep']
export type Graph = S['GraphResponse']
export type GraphNode = S['GraphNode']
export type ConceptDetail = S['ConceptDetail']
export type ResourceItem = S['ResourceItem']
export type Recommendation = S['RecommendationResponse']
export type RecommendationCandidate = S['RecommendationCandidate']
export type Analytics = S['AnalyticsResponse']
export type ContentKind = S['HistoryItem']['content_type']

export * from './next'
