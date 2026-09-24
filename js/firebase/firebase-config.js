/**
 * FIREBASE CONFIGURATION MODULE
 * =====================================================================
 * Terhubung ke Firebase Project: myapp-71a6f
 * =====================================================================
 */

export const FIREBASE_DEFAULTS = {
    apiKey: "AIzaSyDvsnIdLon16FcxMyQ5Aoox59jShmR2880",
    authDomain: "myapp-71a6f.firebaseapp.com",
    projectId: "myapp-71a6f",
    storageBucket: "myapp-71a6f.firebasestorage.app",
    messagingSenderId: "945143783784",
    appId: "1:945143783784:web:edb7e56072c2427bb636dd"
};

/**
 * Mengambil konfigurasi Firebase aktif
 */
export function getFirebaseConfig() {
    try {
        const saved = localStorage.getItem('apex_firebase_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.apiKey && parsed.projectId) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn('Gagal membaca saved Firebase config:', e);
    }
    return FIREBASE_DEFAULTS;
}

/**
 * Menyimpan konfigurasi Firebase baru
 */
export function saveFirebaseConfig(config) {
    if (!config || !config.apiKey || !config.projectId) {
        throw new Error('API Key dan Project ID wajib diisi!');
    }
    localStorage.setItem('apex_firebase_config', JSON.stringify(config));
}

/**
 * Menghapus konfigurasi Firebase (kembali ke local storage)
 */
export function clearFirebaseConfig() {
    localStorage.removeItem('apex_firebase_config');
}

/**
 * Cek apakah Firebase sudah terkonfigurasi dengan benar
 */
export function isFirebaseConfigured() {
    const config = getFirebaseConfig();
    return !!(config && config.apiKey && config.apiKey.trim().length > 10 && config.projectId && config.projectId.trim().length > 2);
}
