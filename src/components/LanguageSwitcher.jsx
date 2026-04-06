import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher({ compact = false }) {
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'is' : 'en'
    i18n.changeLanguage(next)
    localStorage.setItem('nostradamus_lang', next)
  }

  const isIcelandic = i18n.language === 'is'

  if (compact) {
    return (
      <button
        onClick={toggleLanguage}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
        title={isIcelandic ? 'Switch to English' : 'Skipta yfir í íslensku'}
      >
        <span className="text-base">{isIcelandic ? '🇬🇧' : '🇮🇸'}</span>
        <span>{isIcelandic ? 'EN' : 'IS'}</span>
      </button>
    )
  }

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
    >
      <span className="text-lg">{isIcelandic ? '🇬🇧' : '🇮🇸'}</span>
      <span>{isIcelandic ? 'English' : 'Íslenska'}</span>
    </button>
  )
}