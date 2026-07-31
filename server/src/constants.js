export const DB_NAME = "video-streaming"

// ---- Profile constants ----
export const MAX_PROFILES = 4
export const MIN_PROFILES = 1

// language name -> locale code, as requested
export const SUPPORTED_LANGUAGES = {
    English: "en_US",
    German: "de_DE",
    Spanish: "es_ES",
    French: "fr_FR",
    Portuguese: "pt_BR"
}

export const SUPPORTED_LANGUAGE_CODES = Object.values(SUPPORTED_LANGUAGES)

export const KID_AGE_LIMIT = 18

export const ACTIVE_PROFILE_COOKIE = "activeProfileId"