import { useEffect, useState } from 'react'
import type { Submission } from '../types'
import { EVALUATION_POLL_INTERVAL_MS } from '../config'

export function useEvaluationPoll(submissionId?: string) {
  const [submission, setSubmission] = useState<Submission | null>(null)

  useEffect(() => {
    if (!submissionId) return
    const interval = window.setInterval(() => {
      setSubmission((current) => current)
    }, EVALUATION_POLL_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [submissionId])

  return { submission }
}
