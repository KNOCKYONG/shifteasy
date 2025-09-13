export const fallbackLng = 'ko'
export const languages = ['ko', 'en', 'ja']
export const defaultNS = 'common'
export const cookieName = 'i18next'

export function getOptions(lng = fallbackLng, ns = defaultNS) {
  return {
    supportedLngs: languages,
    fallbackLng,
    lng,
    fallbackNS: defaultNS,
    defaultNS,
    ns,
  }
}