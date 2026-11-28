import { ahoraIntranet } from '../../nucleo/RelojPruebas';
export interface UsuarioGuardias { email: string; nombre: string; jefatura: boolean }

export interface Guardia {
  id: string;
  fecha: string;
  desde: string;
  hasta: string;
  grupo: string;
  aula: string;
  tarea: string;
  archivo: string;
  asignada: string;
  asignadaNombre: string;
  estado: 'PENDIENTE' | 'HECHA' | 'ANULADA' | '';
  incidencias: string;
  mia: boolean;
  ausente?: string;
  ausenteEmail?: string;
  idAusencia?: string;
  motivo?: string;
  /** Hora de la propia ausencia: no se dice quién la cubre ni si ha quedado sin cubrir. */
  propia?: boolean;
}

export interface FranjaCuadrante { desde: string; hasta: string; recreo: boolean; docentes: { email: string; nombre: string }[] }

export type Avisar = (texto: string, error?: boolean) => void;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "lunes 23/11/2026" a partir de "2026-11-23". */
export function fechaLarga(f: string): string {
  const [y, m, d] = f.split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS[dia]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function hoyTexto(): string {
  // ahoraIntranet: la hora del servidor (en PRUEBAS puede ser simulada con el reloj de pruebas)
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ahoraIntranet()));
  return p; // yyyy-mm-dd
}

export function sumarDias(f: string, n: number): string {
  const [y, m, d] = f.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Descarga en el navegador un archivo recibido en base64. */
export function descargarBase64(nombre: string, tipo: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre || 'tarea';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function leerComoBase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(archivo);
  });
}
