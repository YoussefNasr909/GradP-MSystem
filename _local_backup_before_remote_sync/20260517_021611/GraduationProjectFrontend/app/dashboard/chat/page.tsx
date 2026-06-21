"use client"

import { Suspense } from "react"
import { ChatWorkspace } from "@/components/features/chat/chat-workspace"

export default function ChatPage() {
  return (
    <div className="h-[calc(100dvh-8rem)] sm:h-[calc(100dvh-10rem)]">
      <Suspense>
        <ChatWorkspace variant="page" className="h-full" />
      </Suspense>
    </div>
  )
}
