import * as SecureStore from 'expo-secure-store';

// Chỉ refresh token được lưu bền (Keychain trên iOS, Keystore trên Android qua expo-secure-store).
// Access token và hạn dùng chỉ nằm trong bộ nhớ. Khóa chỉ được chứa chữ, số, ".", "-", "_".
const REFRESH_KEY = 'hfarm.keycloak.refresh_token';

// expo-secure-store chỉ có trên Android/iOS; môi trường khác (ví dụ chạy bản web để thử giao diện) thì
// không lưu bền: mở lại app sẽ phải đăng nhập lại.
let available;
const isAvailable = async () => (available ??= await SecureStore.isAvailableAsync().catch(() => false));

export async function loadRefreshToken() {
  if (!(await isAvailable())) return null;
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null; // đọc lỗi coi như chưa có phiên
  }
}

export async function saveRefreshToken(token) {
  if (!(await isAvailable())) return;
  try {
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  } catch (e) {
    // Không lưu được thì app vẫn chạy trong phiên này, chỉ là lần mở sau phải đăng nhập lại
    if (__DEV__) console.warn('[auth] Không lưu được refresh token:', e?.message);
  }
}

export async function clearRefreshToken() {
  if (!(await isAvailable())) return;
  try {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch (e) {
    if (__DEV__) console.warn('[auth] Không xóa được refresh token:', e?.message);
  }
}
