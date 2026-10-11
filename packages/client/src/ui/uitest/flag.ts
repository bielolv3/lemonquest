export const UITEST = import.meta.env.DEV && new URLSearchParams(location.search).has("uitest");
