"use client";

import { useCallback, useState } from "react";
import { verifyAdminPassword } from "@/lib/verifyAdminPassword";

type AdminPasswordGateProps = {
  children: React.ReactNode;
  context?: string;
};

export function AdminPasswordGate({
  children,
  context = "continuar",
}: AdminPasswordGateProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = password.trim();
      if (!trimmed) {
        setError("Introduce la contraseña.");
        return;
      }

      setIsVerifying(true);
      setError(null);
      try {
        await verifyAdminPassword(trimmed);
        setAuthorized(true);
      } catch (error) {
        console.error(error);
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo verificar la contraseña.",
        );
      } finally {
        setIsVerifying(false);
      }
    },
    [password],
  );

  if (authorized) return <>{children}</>;

  return (
    <div className="relative">
      <div aria-hidden>{children}</div>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-sm text-card-foreground shadow-lg">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">
              Confirmar contraseña
            </h2>
            <p className="text-xs text-foreground/60">
              Introduce la contraseña para {context}.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              Contraseña
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                  placeholder="Introduce la contraseña"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>

            {error ? <p className="text-xs text-red-500">{error}</p> : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                disabled={isVerifying}
                className="inline-flex cursor-pointer items-center rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-background transition hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isVerifying ? "Verificando..." : "Continuar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
