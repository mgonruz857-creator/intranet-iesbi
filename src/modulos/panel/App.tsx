import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { CalendarClock, DatabaseBackup, GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { llamarApi, type DocentePanel, type FilaHorario } from './api';
import Profesorado from './components/Profesorado';
import Horarios from './components/Horarios';

// Gestión de profesorado, alumnado y copias: usa las pantallas de convivencia (se cargan al abrirla)
const GestionDatos = lazy(() => import('./components/GestionDatos'));

type Pestana = 'profesorado' | 'permisos' | 'horarios' | 'alumnado' | 'copias';

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
            {boton('profesorado', 'Profesorado', Users)}
            {boton('permisos', 'Permisos', ShieldCheck)}
            {boton('horarios', 'Horarios', CalendarClock)}
            {boton('alumnado', 'Alumnado', GraduationCap)}
            {boton('copias', 'Copias de seguridad', DatabaseBackup)}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-4">
        {pestana === 'profesorado' || pestana === 'alumnado' || pestana === 'copias' ? (
          <Suspense fallback={<div className="p-10 text-center text-slate-500">Cargando…</div>}>
            <GestionDatos key={pestana} seccion={pestana} alCambiar={cargar} />
          </Suspense>
        ) : error ? (
          <div className="bg-white border border-red-200 rounded-2xl p-6 text-center text-sm text-red-700">{error}</div>
        ) : profesores === null ? (
          <div className="p-10 text-center text-slate-500">Cargando…</div>
        ) : pestana === 'permisos' ? (
          <Profesorado profesores={profesores} horarios={horarios} avisar={avisar} alCambiar={setProfesores} />
        ) : (
          <Horarios profesores={profesores} horarios={horarios} avisar={avisar} alGuardar={cargar} />
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
