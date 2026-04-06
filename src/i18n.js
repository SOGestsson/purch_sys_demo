import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import is from './locales/is.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      is: { translation: is },
    },
    lng: localStorage.getItem('nostradamus_lang') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n