'use client'

import { type FC } from 'react'

import { WebhooksSettings } from '../settings/webhooks-settings'

interface WebhooksViewProps {
  onClose: () => void
}

/** Webhooks overlay view — wraps the settings component for the dedicated route. */
export const WebhooksView: FC<WebhooksViewProps> = ({ onClose }) => {
  return <WebhooksSettings />
}
