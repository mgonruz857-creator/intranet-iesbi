import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { ES_ENTORNO_PRUEBAS } from '../config/entorno';

interface RespuestaReloj { ok: boolean; simulado?: boolean; ahora?: number; texto?: string; mensaje?: string }
type Llamar = (accion: string, datos?: Record<string, unknown>) => Promise<RespuestaReloj>;

// Horas de la jornada (las de salidas al baño) para elegir rápido
const HORAS = [
  { etiqueta: '1ª hora', hora: '08:45' }, { etiqueta: '2ª hora', hora: '09:45' }, { etiqueta: '3ª hora', hora: '10:45' },
  { etiqueta: 'Recreo', hora: '11:45' }, { etiqueta: '4ª hora', hora: '12:15' }, { etiqueta: '5ª hora', hora: '13:15' },
  { etiqueta: '6ª hora', hora: '14:15' },
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Diferencia entre el reloj del servidor (simulado o no) y el del navegador: la usan las pantallas para "hoy". */
let desfase = 0;
export function ahoraIntranet(): number { return Date.now() + desfase; }

/** Próximo lunes (o hoy si es día lectivo), en AAAA-MM-DD, hora de Madrid. */
function diaLectivo(): string {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
}

function textoLargo(t: string): string {
  const [f, h] = t.split(' ');
  const [y, m, d] = f.split('-').map(Number);
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + ' ' + d + '/' + m + '/' + y + ', ' + h;
}

/**
 * SOLO EN PRUEBAS: barra para simular el día y la hora (salidas y guardias comparten el reloj del servidor).
 * Si el servidor no lo permite (servidor antiguo o PRODUCCIÓN), no se muestra.
 */
export default function RelojPruebas({ llamar, alCambiar }: { llamar: Llamar; alCambiar: () => void }) {
  const [estado, setEstado] = useState<RespuestaReloj | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(diaLectivo);
  const [hora, setHora] = useState('08:45');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ES_ENTORNO_PRUEBAS) return;
    let vigente = true;
    llamar('relojPruebas').then((r) => {
      if (!vigente || !r.ok) return;
      desfase = r.simulado && r.ahora ? r.ahora - Date.now() : 0;
      setEstado(r);
      if (r.simulado) alCambiar();
    });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ES_ENTORNO_PRUEBAS || !estado) return null;

  async function cambiar(datos: Record<string, unknown>) {
    setOcupado(true);
    setError('');
    const r = await llamar('relojPruebas', datos);
    setOcupado(false);
    if (!r.ok) { setError(r.mensaje || 'No se ha podido cambiar el reloj.'); return; }
    desfase = r.simulado && r.ahora ? r.ahora - Date.now() : 0;
    setEstado(r);
    setAbierto(false);
    alCambiar();
  }

  const finde = (() => { const [y, m, d] = fecha.split('-').map(Number); const n = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return n === 0 || n === 6; })();

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="font-semibold">Reloj de pruebas:</span>
        <span>{estado.simulado && estado.texto ? 'simulando ' + textoLargo(estado.texto) : 'hora real'}</span>
        <button onClick={() => setAbierto(!abierto)} className="font-semibold underline">{abierto ? 'Cerrar' : 'Simular otro día y hora'}</button>
        {estado.simulado && (
          <button onClick={() => cambiar({ quitar: true })} disabled={ocupado} className="font-semibold underline disabled:opacity-50">Volver a la hora real</button>
        )}
      </div>
      {abierto && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-0.5">
            <span className="block font-semibold">Día</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-lg border border-amber-300 bg-white px-2 py-1" />
          </label>
          <label className="space-y-0.5">
            <span className="block font-semibold">Hora</span>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="rounded-lg border border-amber-300 bg-white px-2 py-1" />
          </label>
          <div className="flex flex-wrap gap-1" aria-label="Horas de la jornada">
            {HORAS.map((h) => (
              <button key={h.etiqueta} onClick={() => setHora(h.hora)}
                className={'px-2 py-1 rounded-lg border ' + (hora === h.hora ? 'bg-amber-200 border-amber-400 font-semibold' : 'bg-white border-amber-300')}>
                {h.etiqueta}
              </button>
            ))}
          </div>
          <button onClick={() => cambiar({ fijar: fecha + ' ' + hora })} disabled={ocupado || !fecha || !hora}
            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold disabled:opacity-50">
            {ocupado ? 'Cambiando…' : 'Simular'}
          </button>
          {finde && <span className="w-full text-amber-800">Ese día es fin de semana: no habrá clases.</span>}
        </div>
      )}
      {error && <p className="text-red-700">{error}</p>}
      <p className="text-amber-800">Solo en PRUEBAS. Cambia el reloj para todos (salidas y guardias), y luego sigue avanzando solo.</p>
    </div>
  );
}
