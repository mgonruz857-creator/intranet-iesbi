import { useMemo } from 'react';
import { AlertTriangle, UserMinus } from 'lucide-react';
import type { Alumno } from '../types/convivencia';
import type { StorageService } from '../services/storageService';

type VistaPrevia = ReturnType<typeof StorageService.previsualizarImportacionAlumnos>;

interface Props {
  vista: VistaPrevia;
  marcados: Set<string>;
  setMarcados: (s: Set<string>) => void;
}

const nombre = (a: Alumno) => `${a.apellidos}, ${a.nombre}`;
const porGrupo = (lista: Alumno[]) => [...lista].sort((x, y) => (x.grupo || '').localeCompare(y.grupo || '') || nombre(x).localeCompare(nombre(y), 'es'));

/** Lo que va a pasar al importar el archivo de Séneca, antes de guardar, con las bajas de quien ya no figura en él. */
export default function ResumenImportacionSeneca({ vista, marcados, setMarcados }: Props) {
  const abiertos = useMemo(() => new Set(vista.conExpedienteAbierto), [vista]);
  const sinExpediente = porGrupo(vista.faltan.filter((a) => !abiertos.has(a.id_alumno)));
  const conExpediente = porGrupo(vista.faltan.filter((a) => abiertos.has(a.id_alumno)));
  const parcial = vista.activos > 0 && vista.faltan.length > vista.activos / 2;

  const cambiar = (id: string, si: boolean) => {
    const s = new Set(marcados);
    if (si) s.add(id); else s.delete(id);
    setMarcados(s);
  };
  const todos = (si: boolean) => setMarcados(new Set(si ? sinExpediente.map((a) => a.id_alumno).concat([...marcados].filter((id) => abiertos.has(id))) : [...marcados].filter((id) => abiertos.has(id))));

  const fila = (a: Alumno, aviso = false) => (
    <label key={a.id_alumno} className="flex items-center gap-2 py-0.5">
      <input type="checkbox" checked={marcados.has(a.id_alumno)} onChange={(e) => cambiar(a.id_alumno, e.target.checked)} />
      <span className="font-mono text-[11px] text-slate-500 w-16 shrink-0">{a.grupo}</span>
      <span className="text-slate-800">{nombre(a)}</span>
      {aviso && <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 rounded px-1.5">expediente abierto</span>}
    </label>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 text-xs" aria-label="Resumen de la importación">
      <div className="font-bold text-slate-900 text-sm">Qué va a pasar al importar</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Dato titulo="Nuevos" valor={vista.nuevos.length} />
        <Dato titulo="Cambian de grupo" valor={vista.cambianGrupo.length} />
        <Dato titulo="Siguen igual" valor={vista.actualizados - new Set([...vista.cambianGrupo.map((c) => c.alumno.id_alumno), ...vista.vuelven.map((a) => a.id_alumno)]).size} />
        <Dato titulo="Ya no están en Séneca" valor={vista.faltan.length} destacado={vista.faltan.length > 0} />
      </div>

      {vista.cambianGrupo.length > 0 && (
        <details>
          <summary className="cursor-pointer text-slate-600">Ver cambios de grupo ({vista.cambianGrupo.length})</summary>
          <ul className="mt-1 max-h-40 overflow-y-auto pl-4 space-y-0.5">
            {vista.cambianGrupo.map((c) => (
              <li key={c.alumno.id_alumno}>{nombre(c.alumno)}: <span className="font-mono">{c.de}</span> → <span className="font-mono font-semibold">{c.a}</span></li>
            ))}
          </ul>
        </details>
      )}
      {vista.vuelven.length > 0 && (
        <p className="text-slate-600">{vista.vuelven.length} alumno(s) dados de baja vuelven a figurar en Séneca y se reactivan.</p>
      )}

      {vista.faltan.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <UserMinus className="w-4 h-4 text-rose-700" />
            <span className="font-semibold text-slate-900 mr-auto">Dar de baja a quien ya no está en Séneca ({marcados.size} marcados)</span>
            <button type="button" onClick={() => todos(true)} className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">Marcar todos</button>
            <button type="button" onClick={() => todos(false)} className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">Ninguno</button>
          </div>
          <p className="text-slate-500">No se borran: conservan su historial, desaparecen de las listas y salidas y guardias dejan de verlos. Desmarque a quien deba seguir de alta.</p>
          {parcial && (
            <p className="flex gap-1.5 text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Faltan más de la mitad del alumnado activo: parece un archivo parcial (solo algunos grupos), así que no se ha marcado a nadie.
              Para el cambio de curso use el archivo completo del centro.
            </p>
          )}
          {sinExpediente.length > 0 && <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-lg p-2">{sinExpediente.map((a) => fila(a))}</div>}
          {conExpediente.length > 0 && (
            <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-2 space-y-1">
              <div className="font-semibold text-amber-900">Con un expediente abierto: decida usted (sin marcar siguen de alta)</div>
              {conExpediente.map((a) => fila(a, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Dato({ titulo, valor, destacado = false }: { titulo: string; valor: number; destacado?: boolean }) {
  return (
    <div className={`p-2 rounded-xl border text-center ${destacado ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-slate-50/60'}`}>
      <div className="text-[10px] text-slate-500 uppercase font-bold">{titulo}</div>
      <div className="text-base font-bold text-slate-900 tabular-nums">{valor}</div>
    </div>
  );
}
