import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, Input } from "../components/ui";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { authenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("marina@movencar.demo");
  const [password, setPassword] = useState("demo123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (authenticated) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate((location.state as { from?: string })?.from || "/");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Não foi possível entrar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(380px,46%)_1fr]">
      <section className="flex items-center justify-center bg-black p-8 text-white">
        <div className="max-w-lg">
          <img
            src="/movencar-logo.png"
            alt="MOVENCAR"
            className="mb-6 w-full max-w-sm object-contain"
          />
          <p className="mt-4 text-lg text-slate-300">
            Gestão clara para oficinas que querem ganhar velocidade sem perder o
            controle.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-slate-700 pt-8 text-sm">
            <div>
              <strong className="block text-2xl">+28%</strong>produtividade
            </div>
            <div>
              <strong className="block text-2xl">-19%</strong>ociosidade
            </div>
            <div>
              <strong className="block text-2xl">100%</strong>rastreável
            </div>
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-lg border bg-white p-7 shadow-panel"
          noValidate
        >
          <h2 className="text-2xl font-bold">Acesse sua conta</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ambiente demonstrativo MOVENCAR
          </p>
          <label className="mt-6 block text-sm font-semibold">
            E-mail
            <Input
              className="mt-2"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Senha
            <div className="relative mt-2">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-12"
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-2.5 text-slate-500"
              >
                {showPassword ? (
                  <EyeOff className="size-5" />
                ) : (
                  <Eye className="size-5" />
                )}
              </button>
            </div>
          </label>
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-600">
              {error}
            </p>
          )}
          <Button className="mt-6 w-full" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar no MovenCar"}
          </Button>
          <p className="mt-4 text-center text-xs text-slate-500">
            Use as credenciais preenchidas para explorar a demonstração.
          </p>
        </form>
      </section>
    </main>
  );
}
