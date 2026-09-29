export function getServerUrl() {
  const configuredUrl = (import.meta.env as any).VITE_SERVER_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = 3000;

  return `${protocol}//${hostname}:${port}`;
}
