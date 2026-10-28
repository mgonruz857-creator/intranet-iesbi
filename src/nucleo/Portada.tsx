import React from 'react';
import { ChevronRight, LogOut } from 'lucide-react';
import { MODULOS } from './modulos';
import { ES_ENTORNO_PRUEBAS } from '../config/entorno';
import { cerrarSesionIntranet } from './accesoUnico';
import type { Profesor } from '../modulos/convivencia/types/convivencia';
import logo from '../modulos/convivencia/assets/images/logo_rectangular_iesbi.png';

export const Portada: React.FC<{ usuario: Profesor }> = ({ usuario }) => (
  <div className="min-h-screen bg-gradient-to-br from-sky-50/40 via-slate-50 to-blue-50/30 flex flex-col">
    {ES_ENTORNO_PRUEBAS && (
      <div className="w-full bg-amber-400 text-amber-950 text-center text-sm font-semibold py-1.5 px-4">
        ENTORNO DE PRUEBAS · Datos ficticios · No introducir datos reales del alumnado
      </div>
    )}
    <div className="w-full max-w-4xl mx-auto px-4 pt-4 flex items-center justify-end gap-3 text-sm">
      <span className="text-slate-500 truncate">{[usuario.nombre, usuario.apellidos].filter(Boolean).join(' ')}</span>
      <button onClick={cerrarSesionIntranet}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-700">
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </button>
    </div>
    <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
      <header className="flex flex-col items-center text-center gap-4 mb-10">
        <img src={logo} alt="IES Blas Infante" className="h-16 w-auto" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Intranet IES Blas Infante</h1>
          <p className="text-slate-500 text-sm mt-1">Aplicaciones del centro para el profesorado</p>
        </div>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map(({ id, nombre, descripcion, icono: Icono, disponible }) => {
          const contenido = (
            <>
              <div className="flex items-center gap-3">
                <span className={`p-2.5 rounded-xl ${disponible ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-400'}`}>
                  <Icono className="w-6 h-6" />
                </span>
                <h2 className="font-semibold text-slate-900">{nombre}</h2>
                {disponible && <ChevronRight className="w-4 h-4 ml-auto text-slate-400" />}
              </div>
              <p className="text-sm text-slate-500 mt-3">{descripcion}</p>
              {!disponible && <p className="text-xs font-semibold text-slate-400 mt-3">Próximamente</p>}
            </>
          );
          return (
            <li key={id}>
              {disponible ? (
                <a href={`#/${id}`} className="block h-full bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-sky-300 hover:shadow-md transition">
                  {contenido}
                </a>
              ) : (
                <div className="h-full bg-white/60 rounded-2xl border border-dashed border-slate-200 p-5" aria-disabled="true">
                  {contenido}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
    <footer className="text-center text-xs text-slate-400 py-6">I.E.S. Blas Infante · Córdoba</footer>
  </div>
);
