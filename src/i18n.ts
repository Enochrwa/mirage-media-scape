import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          "Music": "Music",
          "Videos": "Videos",
          "Playlists": "Playlists",
          "Favorites": "Favorites",
          "Upload": "Upload",
          "Settings": "Settings",
          "Language": "Language",
          "Search": "Search",
          "Home": "Home",
          "Dashboard": "Dashboard",
          "YOUR PLAYLISTS": "YOUR PLAYLISTS"
        }
      },
      es: {
        translation: {
          "Music": "Música",
          "Videos": "Videos",
          "Playlists": "Listas de reproducción",
          "Favorites": "Favoritos",
          "Upload": "Subir",
          "Settings": "Configuración",
          "Language": "Idioma",
          "Search": "Buscar",
          "Home": "Inicio",
          "Dashboard": "Tablero",
          "YOUR PLAYLISTS": "TUS LISTAS DE REPRODUCCIÓN"
        }
      }
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
