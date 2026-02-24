/** Strip structured block tags from user-originated text to prevent prompt injection. */
export function stripBlockTags(text: string): string {
  return text.replace(
    /\[\/?(FILE_UPDATE|DOMAIN_SUMMARY|LIFE_MAP_SYNTHESIS|SESSION_SUMMARY|SUGGESTED_REPLIES|INLINE_CARD|INTENTION_CARD|DAY_PLAN_DATA|ENTER_MODE)[^\]]*\]/g,
    ''
  )
}
