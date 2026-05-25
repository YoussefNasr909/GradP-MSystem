"use client"

import { Suspense } from "react"
import { ChatWorkspace } from "@/components/features/chat/chat-workspace"

export default function ChatPage() {
  return (
    <div className="h-[calc(100dvh-5rem)] sm:h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-6.5rem)]">
      <Suspense>
        <ChatWorkspace variant="page" className="h-full" />
      </Suspense>
    </div>
  )
}
