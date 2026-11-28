import { useEffect, useState } from 'react';
import { llamarApi } from '../api';
import type { Avisar } from '../tipos';

interface Fila { email: string; nombre: string; hechas: number; pendientes: number; conflictivas?: number; horasGuardia: number }

/** Jefatura: guardias hechas por cada docente en el curso (empieza de cero el 1 de septiembre). */
export default function Recuento({ avisar }: { avisar: Avisar }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [desde, setDesde] = useState('');

  useEffect(() => {
    llamarApi<{ docentes: Fila[]; desde: string }>('recuento').then((r) => {
      if (!r.ok) { avisar(r.mensaje || 'No se ha podido cargar el recuento.', true); setFilas([]); return; }
      setFilas(r.docentes);
      setDesde(r.desde);
    });
  }, [avisar]);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
      <div>
        <h2 className="text-sm font-bold">Recuento de guardias del curso</h2>
        {desde && <p className="text-xs text-slate-500">Desde el {desde.split('-').reverse().join('/')}. El reparto automático elige a quien menos lleva y rota quién cubre los grupos conflictivos (FP, FP Básica, 3º ESO A, 3º ESO C y 4º ESO A).</p>}
      </div>
      {filas === null ? <p className="text-sm text-slate-500">Cargando…</p> : !filas.length ? (
        <p className="text-sm text-slate-500">Todavía no hay guardias ni horas de guardia en el horario.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="p-2 font-semibold">Docente</th>
                <th className="p-2 font-semibold text-right">Hechas</th>
                <th className="p-2 font-semibold text-right">Pendientes</th>
                <th className="p-2 font-semibold text-right">En grupos conflictivos</th>
                <th className="p-2 font-semibold text-right">Horas de guardia a la semana</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.email} className="border-b border-slate-100">
                  <td className="p-2">{f.nombre}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{f.hechas}</td>
                  <td className="p-2 text-right tabular-nums">{f.pendientes}</td>
                  <td className="p-2 text-right tabular-nums">{f.conflictivas ?? 0}</td>
                  <td className="p-2 text-right tabular-nums">{f.horasGuardia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
