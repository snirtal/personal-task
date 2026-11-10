export function publicNeonUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return "";
  let url;
  try {
    url = new URL(value.trim());
  } catch (error) {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (url.username || url.password) return "";
  if (url.search || url.hash) return "";
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function publicConfig(env) {
  const source = env || {};
  const authUrl = publicNeonUrl(source.VITE_NEON_AUTH_URL) || publicNeonUrl(source.NEON_AUTH_BASE_URL);
  const dataApiUrl = publicNeonUrl(source.NEON_DATA_API_URL);
  if (!authUrl || !dataApiUrl) return null;
  return { authUrl, dataApiUrl };
}
