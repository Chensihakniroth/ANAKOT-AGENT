'use client'

import React from 'react'
import { Component, type ComponentProps, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { ErrorState, type ErrorStateProps } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'

export interface ErrorBoundaryFallbackProps {
  error: Error
  reset: () => void
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (props: ErrorBoundaryFallbackProps) => ReactNode
  label?: string
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

const isTransientAssistantUiLookupError = (error: Error): boolean =>
  /(useClientLookup|tapClient(Lookup|Resource)).*out of bounds/.test(error.message)

const MAX_AUTO_RECOVERIES = 3
const AUTO_RECOVERY_WINDOW_MS = 5_000

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }
  private autoRecoveryCount = 0
  private autoRecoveryPending = false
  private autoRecoveryTimer: ReturnType<typeof setTimeout> | null = null

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  private scheduleAutoRecovery = (): void => {
    this.autoRecoveryPending = true
    this.autoRecoveryTimer = setTimeout(() => {
      if (this.autoRecoveryPending && this.state.error) {
        const error = this.state.error
        if (isTransientAssistantUiLookupError(error) && this.autoRecoveryCount < MAX_AUTO_RECOVERIES) {
          this.autoRecoveryCount++
          this.setState({ error: null })
          this.autoRecoveryPending = false
        }
      } else {
        this.autoRecoveryPending = false
      }
    }, AUTO_RECOVERY_WINDOW_MS)
  }

  private handleReset = (): void => {
    this.setState({ error: null })
    this.autoRecoveryCount = 0
    this.autoRecoveryPending = false
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      const error = this.state.error
      return this.props.fallback
        ? this.props.fallback({ error, reset: this.handleReset })
        : (
          <ErrorState
            title={this.props.label ?? 'Something went wrong'}
            description="An unexpected error occurred. You can try resetting this section."
            className="flex-1 flex flex-col items-center justify-center px-8 py-16 gap-3"
          >
            <Button onClick={this.handleReset} variant="outline" className="mt-2">
              Try Again
            </Button>
          </ErrorState>
        )
    }

    return this.props.children
  }
}

/** Wrap any component tree with error recovery. Catches render errors, auto-recovers
 *  from transient assistant-ui lookup failures, and surfaces a reset UI otherwise. */
export const withErrorBoundary = <P extends object>(
  Wrapped: React.ComponentType<P>,
  props: P,
  options?: Pick<ErrorBoundaryProps, 'label' | 'onError'>,
): React.ReactElement => {
  return <ErrorBoundary {...options}>{React.createElement(Wrapped, props)}</ErrorBoundary>
}
