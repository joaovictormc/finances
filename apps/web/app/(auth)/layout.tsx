import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <Logo size={32} className="text-2xl" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle financeiro inteligente
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
