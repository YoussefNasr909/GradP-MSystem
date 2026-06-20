export type CosmeticRewardType = "TITLE" | "AVATAR_FRAME" | "PROFILE_THEME" | "BADGE_SKIN"

type RewardStyle = {
  label: string
  shortLabel: string
  description: string
  previewLabel: string
  cardClass: string
  iconClass: string
  badgeClass: string
  previewClass: string
  swatchClass: string
  actionClass: string
}

const rewardStyles: Record<CosmeticRewardType, RewardStyle> = {
  TITLE: {
    label: "Title",
    shortLabel: "Nameplate",
    description: "A visible title beside the student name.",
    previewLabel: "Project Architect",
    cardClass: "border-emerald-500/30 bg-emerald-500/5",
    iconClass: "bg-emerald-500/10 text-emerald-600",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    previewClass: "border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-background",
    swatchClass: "from-emerald-500 to-teal-500",
    actionClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  AVATAR_FRAME: {
    label: "Avatar Frame",
    shortLabel: "Frame",
    description: "A border treatment around the profile avatar.",
    previewLabel: "Gold circuit frame",
    cardClass: "border-amber-500/35 bg-amber-500/5",
    iconClass: "bg-amber-500/10 text-amber-600",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    previewClass: "border-amber-500/40 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_42%),rgba(245,158,11,0.05)]",
    swatchClass: "from-amber-400 to-orange-500",
    actionClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  PROFILE_THEME: {
    label: "Profile Theme",
    shortLabel: "Theme",
    description: "A profile background and accent palette.",
    previewLabel: "Midnight lab theme",
    cardClass: "border-cyan-500/30 bg-cyan-500/5",
    iconClass: "bg-cyan-500/10 text-cyan-600",
    badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    previewClass: "border-cyan-500/30 bg-gradient-to-br from-cyan-500/15 via-sky-500/10 to-indigo-500/10",
    swatchClass: "from-cyan-400 to-indigo-500",
    actionClass: "bg-cyan-700 hover:bg-cyan-800 text-white",
  },
  BADGE_SKIN: {
    label: "Badge Skin",
    shortLabel: "Badge",
    description: "A special finish applied to earned badge cards.",
    previewLabel: "Prismatic badge finish",
    cardClass: "border-rose-500/30 bg-rose-500/5",
    iconClass: "bg-rose-500/10 text-rose-600",
    badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    previewClass: "border-rose-500/30 bg-[linear-gradient(135deg,rgba(244,63,94,0.14),rgba(168,85,247,0.10),rgba(250,204,21,0.12))]",
    swatchClass: "from-rose-500 to-violet-500",
    actionClass: "bg-rose-600 hover:bg-rose-700 text-white",
  },
}

export function getRewardStyle(type?: string | null) {
  if (type && type in rewardStyles) return rewardStyles[type as CosmeticRewardType]
  return rewardStyles.TITLE
}
