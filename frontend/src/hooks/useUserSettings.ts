import { useAuthStore } from '../store/useAuthStore';
import axios from 'axios';
import { API_BASE } from '../lib/utils';
import { debounce } from 'lodash-es';

const debouncedSave = debounce(async (key: string, value: any) => {
    await axios.put(`${API_BASE}/api/settings/user`, { key, value: String(value) });
}, 300);

export function useUserSettings() {
    const { user, accessToken } = useAuthStore();
    const isAuthenticated = !!user && !!accessToken;

    const saveSetting = (key: string, value: any) => {
        if (isAuthenticated) {
            debouncedSave(key, value);
        } else {
            localStorage.setItem(`ZOVYRA_${key}`, String(value));
        }
    };

    const getSetting = (key: string, defaultValue: string): string => {
        return localStorage.getItem(`ZOVYRA_${key}`) || defaultValue;
    };

    return { saveSetting, getSetting, isAuthenticated };
}
