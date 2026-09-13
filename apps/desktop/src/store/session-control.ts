import { atom } from 'nanostores'
// Session control — ported from Hermes
export type SessionControlGoalStatus = 'active' | 'done' | 'paused'
export type SessionControlLoopMode = 'interval' | 'self_paced'
export type SessionControlLoopStatus = 'active' | 'done' | 'paused'
export type SessionControlHeartbeatStatus = 'active' | 'paused'
export interface SessionControlGoalContract { boundaries: string; constraints: string; outcome: string; stop_when: string; verification: string }
export interface SessionControlGate { attempts: number; command: string; last_exit_code: number | null; max_retries: number; timeout_seconds: number }
export type SessionControlWaitBarrier = { reason: string; type: 'until'; until_at: number } | { reason: string; target: string; type: 'session' } | { reason: string; target: number; type: 'pid' }
export interface SessionControlGoal { contract: SessionControlGoalContract; gates: SessionControlGate[]; last_reason?: string; last_verdict?: 'blocked' | 'continue' | 'done' | 'skipped' | 'wait'; max_turns: number; paused_reason?: string; status: SessionControlGoalStatus; subgoals: string[]; title: string; turns_used: number; updated_at?: number; wait_barrier?: SessionControlWaitBarrier; created_at?: number }
export interface SessionControlLoop { awaiting_response: boolean; created_at: number; current_delay: number; deferred_by_goal: boolean; interval_seconds: number; last_fired_at: number; last_stop_reason?: string; max_ticks: number; mode: SessionControlLoopMode; next_due_at: number; paused_reason?: string; status: SessionControlLoopStatus; ticks_used: number }
export interface SessionControlHeartbeat { sessionId: string; status: SessionControlHeartbeatStatus; last_beat_at: number }
export const $sessionControlState = atom<Record<string, { goals: SessionControlGoal[]; loops: SessionControlLoop[]; heartbeat?: SessionControlHeartbeat }>>({})