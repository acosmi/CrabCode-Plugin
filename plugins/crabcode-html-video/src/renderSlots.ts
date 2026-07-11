let activeRenders = 0

function maxConcurrentRenders(): number {
  const configured = Number(process.env.CRABCODE_HTML_VIDEO_MAX_CONCURRENT_RENDERS || 1)
  if (!Number.isFinite(configured) || configured < 1) return 1
  return Math.min(4, Math.floor(configured))
}

export function tryAcquireRenderSlot(): (() => void) | null {
  if (activeRenders >= maxConcurrentRenders()) return null
  activeRenders += 1
  let released = false
  return () => {
    if (released) return
    released = true
    activeRenders = Math.max(0, activeRenders - 1)
  }
}

export function renderSlotStatus(): { active: number; max: number } {
  return { active: activeRenders, max: maxConcurrentRenders() }
}
