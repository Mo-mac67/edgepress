"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";

// ─── Types ──────────────────────────────────────────────
type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
interface PromptOpts {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  /** Optional live validator — return an error string to block submit. */
  validate?: (v: string) => string | null;
}

interface AdminUI {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<string | null>;
}

const Ctx = createContext<AdminUI | null>(null);

export function useAdminUI(): AdminUI {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminUI must be used inside <AdminUIProvider>");
  return ctx;
}

// ─── Provider ───────────────────────────────────────────
export function AdminUIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);
  const [promptState, setPromptState] = useState<{ opts: PromptOpts; resolve: (v: string | null) => void } | null>(null);
  const idRef = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirmState({ opts, resolve })), []);
  const prompt = useCallback((opts: PromptOpts) => new Promise<string | null>((resolve) => setPromptState({ opts, resolve })), []);

  const api = useMemo<AdminUI>(() => ({ toast, confirm, prompt }), [toast, confirm, prompt]);

  return (
    <Ctx.Provider value={api}>
      {/* .admin-ui: the panel (incl. toasts + dialogs) wears a FIXED
          professional graphite palette (globals.css) instead of inheriting
          the site's marketing theme — the admin looks identical everywhere. */}
      <div className="admin-ui contents">
      {children}

      {/* Toast stack */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[200] flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2">
        {toasts.map((t) => {
          const icon: IconName = t.kind === "success" ? "check" : t.kind === "error" ? "x" : "info";
          const tone = t.kind === "success" ? "border-green-500/30 bg-green-50 text-green-800" : t.kind === "error" ? "border-red-500/30 bg-red-50 text-red-800" : "border-line bg-white text-ink";
          return (
            <div key={t.id} className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg ${tone} animate-[fadeIn_0.15s_ease]`}>
              <Icon name={icon} size={17} className="mt-0.5 shrink-0" />
              <p className="flex-1 text-sm leading-snug">{t.message}</p>
              <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="shrink-0 text-current/60 hover:text-current"><Icon name="x" size={14} /></button>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <ConfirmDialog
          {...confirmState.opts}
          onResolve={(v) => {
            confirmState.resolve(v);
            setConfirmState(null);
          }}
        />
      )}
      {promptState && (
        <PromptDialog
          {...promptState.opts}
          onResolve={(v) => {
            promptState.resolve(v);
            setPromptState(null);
          }}
        />
      )}
      </div>
    </Ctx.Provider>
  );
}

// ─── Modal shell ────────────────────────────────────────
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-brand-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 max-h-[88vh] w-full ${wide ? "max-w-3xl" : "max-w-md"} overflow-auto rounded-2xl bg-white p-6 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="font-display text-lg font-bold text-brand">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-soft hover:bg-sand hover:text-ink"><Icon name="x" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onResolve }: ConfirmOpts & { onResolve: (v: boolean) => void }) {
  return (
    <Modal title={title} onClose={() => onResolve(false)}>
      {message && <p className="text-sm leading-relaxed text-ink-soft">{message}</p>}
      <div className="mt-6 flex justify-end gap-2.5">
        <button onClick={() => onResolve(false)} className="btn-secondary py-2 text-sm">{cancelLabel ?? "Cancel"}</button>
        <button
          onClick={() => onResolve(true)}
          className={`py-2 text-sm ${danger ? "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 font-semibold text-white hover:bg-red-700" : "btn-primary"}`}
        >
          {confirmLabel ?? "Confirm"}
        </button>
      </div>
    </Modal>
  );
}

function PromptDialog({ title, message, label, placeholder, defaultValue, confirmLabel, validate, onResolve }: PromptOpts & { onResolve: (v: string | null) => void }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const submit = () => {
    const err = validate?.(value) ?? null;
    if (err) {
      setError(err);
      return;
    }
    onResolve(value);
  };
  return (
    <Modal title={title} onClose={() => onResolve(null)}>
      {message && <p className="mb-3 text-sm text-ink-soft">{message}</p>}
      {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
      <input
        ref={inputRef}
        className="field"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-2.5">
        <button onClick={() => onResolve(null)} className="btn-secondary py-2 text-sm">Cancel</button>
        <button onClick={submit} className="btn-primary py-2 text-sm">{confirmLabel ?? "OK"}</button>
      </div>
    </Modal>
  );
}
