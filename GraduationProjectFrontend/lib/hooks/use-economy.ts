"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiRequestError } from "@/lib/api/http"
import { economyApi, type EconomyOverview, type PaginatedCoinTransactions } from "@/lib/api/economy"

function getErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return "Something went wrong"
}

type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

function useAsyncResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })
  const [reloadToken, setReloadToken] = useState(0)

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setState((current) => ({ ...current, loading: true, error: null }))
      try {
        const data = await loader()
        if (cancelled) return
        setState({ data, loading: false, error: null })
      } catch (err) {
        if (cancelled) return
        setState({ data: null, loading: false, error: getErrorMessage(err) })
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

export function useEconomyOverview() {
  return useAsyncResource<EconomyOverview>(() => economyApi.overview(), [])
}

export function useCoinTransactions(page = 1, limit = 20) {
  return useAsyncResource<PaginatedCoinTransactions>(() => economyApi.transactions({ page, limit }), [page, limit])
}
