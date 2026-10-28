import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { ES_ENTORNO_PRUEBAS } from '../config/entorno';

/** Franja fina sobre cada módulo para volver a la portada. No sale al imprimir. */
export const BarraIntranet: React.FC<{ modulo: string }> = ({ modulo }) => (
  <div className="no-print w-full bg-slate-900 text-slate-100 text-xs">
    <div className="max-w-7xl mx-auto px-4 h-8 flex items-center gap-3">
      <a href="#/" className="flex items-center gap-1.5 font-semibold hover:text-sky-300">
        <LayoutGrid className="w-3.5 h-3.5" />
        Intranet IESBI
      </a>
      <span className="text-slate-500">/</span>
      <span className="text-slate-300">{modulo}</span>
      {ES_ENTORNO_PRUEBAS && <span className="ml-auto text-amber-300 font-semibold">PRUEBAS</span>}
    </div>
  </div>
);
