/**
 * Credenciales de Azure AI Speech que pone CADA usuario (su propia cuenta).
 *
 * MODELO DE SEGURIDAD — por qué así:
 *   - La clave NUNCA llega a nuestro servidor: el navegador habla directamente
 *     con Microsoft (ver azure-engine.ts). Si la web tuviera un fallo en el
 *     servidor, o alguien leyera sus registros, no habría claves que robar.
 *   - Por defecto se guarda en `sessionStorage`: desaparece al cerrar la
 *     pestaña. Solo si el usuario marca "Recordar" va a `localStorage`.
 *   - Lo que se guarda se VALIDA al leerlo: una región con caracteres raros
 *     podría desviar la clave a otro dominio (`https://${region}.…`), así que
 *     solo se aceptan letras minúsculas y números.
 *   - Lo que no podemos evitar: cualquier código que se ejecute en esta web
 *     (por ejemplo, una extensión del navegador con permisos) podría leerla.
 *     Por eso se recomienda una clave del plan GRATUITO (F0): si se filtrara,
 *     no se le puede cobrar nada a nadie, y en Azure se regenera con un clic.
 */
export interface AzureCredentials {
  key: string;
  /** Región del recurso de Azure, p. ej. "westeurope". */
  region: string;
}

const STORAGE_KEY = "aedos:azure";

// Las claves de Azure son 32 caracteres hexadecimales (formato antiguo) u 84
// alfanuméricos (formato nuevo). Aceptamos ese rango con margen.
const KEY_PATTERN = /^[A-Za-z0-9]{32,100}$/;
// Regiones: "westeurope", "francecentral", "eastus2"... Nada de puntos, barras
// ni dos puntos, que permitirían construir una URL de otro dominio.
const REGION_PATTERN = /^[a-z0-9]{3,30}$/;

/** Normaliza y valida lo que escribe el usuario. Devuelve las credenciales o un mensaje de error. */
export function parseAzureCredentials(key: string, region: string): AzureCredentials | string {
  const clean = { key: key.trim(), region: region.trim().toLowerCase().replaceAll(" ", "") };
  if (!KEY_PATTERN.test(clean.key)) return "La clave no tiene el formato de Azure (32 u 84 letras y números).";
  if (!REGION_PATTERN.test(clean.region)) return "La región debe ser como «westeurope» o «francecentral».";
  return clean;
}

/** Lee las credenciales guardadas (primero las de esta pestaña). null si no hay o no son válidas. */
export function loadAzureCredentials(): AzureCredentials | null {
  for (const storage of storages()) {
    try {
      const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
      if (saved && typeof saved.key === "string" && typeof saved.region === "string") {
        const parsed = parseAzureCredentials(saved.key, saved.region);
        if (typeof parsed !== "string") return parsed;
      }
    } catch {
      // JSON corrupto o almacenamiento bloqueado: como si no hubiera nada.
    }
  }
  return null;
}

/** Guarda las credenciales en UN solo sitio: la pestaña o, si `remember`, el navegador. */
export function saveAzureCredentials(credentials: AzureCredentials, remember: boolean): void {
  clearAzureCredentials();
  (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(credentials));
}

/** ¿Están guardadas de forma permanente (localStorage)? Para marcar la casilla "Recordar". */
export function isAzureRemembered(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearAzureCredentials(): void {
  for (const storage of storages()) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Bloqueado: no había nada que borrar.
    }
  }
}

/** sessionStorage y localStorage; acceder a ellos puede lanzar en modo privado estricto. */
function storages(): Storage[] {
  try {
    return [sessionStorage, localStorage];
  } catch {
    return [];
  }
}
