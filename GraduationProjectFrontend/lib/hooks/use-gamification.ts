"use client"

import { useState, useEffect, useCallback } from "react"
import {
  gamificationApi,
  type GamificationOverview,
  type PaginatedTransactions,
  type BadgeInfo,
  type LeaderboardResult,
  type TeamSummary,
} from "@/lib/api/gamification"

type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })
  const [reloadToken, setReloadToken] = useState(0)

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const data = await fetcher()
        if (cancelled) return
        setState({ data, loading: false, error: null })
      } catch (err: any) {
        if (cancelled) return
        setState({ data: null, loading: false, error: err?.message ?? "Failed to load" })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken])

  return { ...state, refetch }
}

export function useGamificationOverview() {
  return useAsync<GamificationOverview>(() => gamificationApi.getOverview())
}

export function useGamificationHistory(page = 1, limit = 20) {
  return useAsync<PaginatedTransactions>(
    () => gamificationApi.getHistory({ page, limit }),
    [page, limit],
  )
}

export function useGamificationBadges() {
  return useAsync<BadgeInfo[]>(() => gamificationApi.getBadges())
}

export function useLeaderboard(type = "INDIVIDUAL_WEEKLY", page = 1, limit = 20) {
  return useAsync<LeaderboardResult>(
    () => gamificationApi.getLeaderboards({ type, page, limit }),
    [type, page, limit],
  )
}

export function useTeamGamificationSummary(teamId?: string | null) {
  return useAsync<TeamSummary | null>(
    async () => {
      if (!teamId) return null
      return gamificationApi.getTeamSummary(teamId)
    },
    [teamId],
  )
}
