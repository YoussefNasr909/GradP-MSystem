import { apiRequest } from "./http"
import type {
  ApiTeamGroupChatBootstrap,
  ApiTeamGroupChatConversationMessages,
  ApiTeamGroupChatSeenResult,
  ApiTeamGroupChatSendResult,
} from "./types"

export const teamChatApi = {
  bootstrap: () => apiRequest<ApiTeamGroupChatBootstrap>("/team-chats/bootstrap"),
  messages: (conversationId: string) =>
    apiRequest<ApiTeamGroupChatConversationMessages>(`/team-chats/conversations/${conversationId}/messages`),
  send: (conversationId: string, payload: { content?: string }, file?: File) => {
    if (file) {
      const formData = new FormData()
      if (payload.content) {
        formData.append("content", payload.content)
      }
      formData.append("file", file)

      return apiRequest<ApiTeamGroupChatSendResult>(`/team-chats/conversations/${conversationId}/messages`, {
        method: "POST",
        body: formData,
      })
    }

    return apiRequest<ApiTeamGroupChatSendResult>(`/team-chats/conversations/${conversationId}/messages`, {
      method: "POST",
      body: payload,
    })
  },
  markSeen: (conversationId: string) =>
    apiRequest<ApiTeamGroupChatSeenResult>(`/team-chats/conversations/${conversationId}/seen`, {
      method: "PATCH",
    }),
}
