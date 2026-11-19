import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, GraduationCap, Users } from 'lucide-react';
import { llamarApi, type DocentePanel, type FilaHorario } from './api';
import Profesorado from './components/Profesorado';
import Horarios from './components/Horarios';

type Pestana = 'profesorado' | 'horarios' | 'alumnado';

export interface AvisoPanel { texto: string; error: boolean; id: number }

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('profesorado');
  const [profesores, setProfesores] = useState<DocentePanel[] | null>(null);
  const [horarios, setHorarios] = useState<FilaHorario[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState<AvisoPanel | null>(null);

  const avisar = useCallback((texto: string, esError = false) => setAviso({ texto, error: esError, id: Date.now() }), []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  const cargar = useCallback(async () => {
    const r = await llamarApi('panelLeer');
    if (!r.ok) { setError(r.error || 'No se han podido cargar los datos del centro.'); return; }
    setError('');
    setProfesores(r.profesores as DocentePanel[]);
    setHorarios(r.horarios as FilaHorario[]);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const boton = (p: Pestana, texto: string, Icono: typeof Users) => (
    <button onClick={() => setPestana(p)}
      className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ' +
        (pestana === p ? 'bg-sky-50 border-sky-200 text-sky-950' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')}>
      <Icono className="w-4 h-4 text-sky-600" />
      <span>{texto}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="font-bold text-sky-950">Panel del centro</h1>
            <p className="text-[11px] text-slate-500">Datos comunes a todos los módulos de la intranet</p>
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {boton('profesorado', 'Profesorado y permisos', Users)}
            {boton('horarios', 'Horarios', CalendarClock)}
            {boton('alumnado', 'Alumnado', GraduationCap)}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-4">
        {error ? (
          <div className="bg-white border border-red-200 rounded-2xl p-6 text-center text-sm text-red-700">{error}</div>
        ) : profesores === null ? (
          <div className="p-10 text-center text-slate-500">Cargando…</div>
        ) : pestana === 'profesorado' ? (
          <Profesorado profesores={profesores} horarios={horarios} avisar={avisar} alCambiar={setProfesores} />
        ) : pestana === 'horarios' ? (
          <Horarios profesores={profesores} horarios={horarios} avisar={avisar} alGuardar={cargar} />
        ) : (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 text-sm text-slate-700 space-y-2">
            <p>
              De momento, el alumnado y las altas y bajas del profesorado se gestionan en{' '}
              <a href="#/convivencia" className="font-semibold text-sky-700 hover:underline">Convivencia</a>
              {' '}(administradores de convivencia), desde la importación de Séneca, como hasta ahora.
            </p>
            <p className="text-slate-500">
              Son los mismos datos que usa toda la intranet, así que lo que se cambie allí llega a los demás módulos.
              En un próximo paso esa gestión pasará a este panel.
            </p>
          </section>
        )}
      </main>
      {aviso && (
        <div role="status" className={'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ' +
          (aviso.error ? 'bg-red-600 text-white' : 'bg-slate-900 text-white')}>
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
