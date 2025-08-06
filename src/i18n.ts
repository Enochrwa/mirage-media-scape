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
      },
      fr: {
        translation: {
          "Music": "Musique",
          "Videos": "Vidéos",
          "Playlists": "Listes de lecture",
          "Favorites": "Favoris",
          "Upload": "Télécharger",
          "Settings": "Paramètres",
          "Language": "Langue",
          "Search": "Rechercher",
          "Home": "Accueil",
          "Dashboard": "Tableau de bord",
          "YOUR PLAYLISTS": "VOS LISTES DE LECTURE"
        }
      },
      kin: {
        translation: {
          "Music": "Ummuziki",
          "Videos": "Amashusho",
          "Playlists": "Urutonde rw'indirimbo",
          "Favorites": "Ibyakozwe",
          "Upload": "Ohereza",
          "Settings": "Igenamiterere",
          "Language": "Ururimi",
          "Search": "Shakisha",
          "Home": "Ahabanza",
          "Dashboard": "Ingingo",
          "YOUR PLAYLISTS": "URUTONDE RW'INDIRIMBO ZACU"
        }
      },
      sw: {
        translation: {
          "Music": "Muziki",
          "Videos": "Video",
          "Playlists": "Orodha za kucheza",
          "Favorites": "Vipendwa",
          "Upload": "Pakia",
          "Settings": "Mipangilio",
          "Language": "Lugha",
          "Search": "Tafuta",
          "Home": "Nyumbani",
          "Dashboard": "Dashibodi",
          "YOUR PLAYLISTS": "ORODHA ZAKO ZA KUCHEZA"
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
