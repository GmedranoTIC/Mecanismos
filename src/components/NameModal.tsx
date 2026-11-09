import React, { useState } from 'react';
import { User, Sparkles, Check } from 'lucide-react';
import { sounds } from '../audio';

interface NameModalProps {
  initialName: string;
  onSaveName: (name: string) => void;
  onCancel?: () => void;
  isFirstTime?: boolean;
}

export const NameModal: React.FC<NameModalProps> = ({
  initialName,
  onSaveName,
  onCancel,
  isFirstTime = false,
}) => {
  const [name, setName] = useState(initialName || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || 'Alumno de Tecnología';
    sounds.playClick();
    onSaveName(cleanName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-gradient-to-b from-[#20313a] to-[#152026] border-2 border-amber-500/50 rounded-2xl shadow-2xl p-6 text-white text-center relative">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
          <User size={30} />
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-amber-400">
          {isFirstTime ? '¡Bienvenido a Mecanismos!' : 'Perfil del Jugador'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 mb-5">
          {isFirstTime
            ? 'Introduce tu nombre para personalizar tu progreso y las capturas de tus máquinas en la ESO.'
            : 'Modifica el nombre que aparecerá en tus diplomas y capturas de pantalla.'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Escribe tu nombre o apodo..."
              maxLength={25}
              autoFocus
              className="w-full px-4 py-3 bg-[#11191d] border border-slate-600 focus:border-amber-400 rounded-xl text-base text-white placeholder-slate-500 outline-none text-center font-bold shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            {!isFirstTime && onCancel && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onCancel();
                }}
                className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-sm transition cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-md transition active:scale-95 cursor-pointer"
            >
              <Check size={18} />
              <span>{isFirstTime ? 'Comenzar a Jugar' : 'Guardar Nombre'}</span>
            </button>
          </div>
        </form>

        <div className="text-[11px] text-slate-400 mt-5">
          Juego educativo de mecanismos para la ESO · Creado por <strong className="text-amber-400">@GmedranoTIC</strong>
        </div>
      </div>
    </div>
  );
};
