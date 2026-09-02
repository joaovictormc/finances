import Link from "next/link";
import { Users, Receipt, Bot, CreditCard, ArrowRight, Sparkles, Tag } from "lucide-react";

const sections = [
  {
    href: "/admin/users",
    title: "Usuários e Planos",
    description: "Liste usuários, altere planos/roles e gerencie assinaturas",
    icon: Users,
  },
  {
    href: "/admin/payment-methods",
    title: "Métodos de Pagamento",
    description: "Configure Mercado Pago, Pix e outros checkouts disponíveis",
    icon: CreditCard,
  },
  {
    href: "/admin/pricing",
    title: "Precificação",
    description: "Defina o valor de cada plano nos períodos mensal, semestral e anual",
    icon: Tag,
  },
  {
    href: "/admin/checkouts",
    title: "Checkouts",
    description: "Histórico de eventos de cobrança",
    icon: Receipt,
  },
  {
    href: "/admin/ai",
    title: "Modelos de IA",
    description: "Configure o modelo ativo, kill-switches e veja uso/custo",
    icon: Bot,
  },
  {
    href: "/admin/gamification",
    title: "Roleta Semanal",
    description: "Defina os prêmios sorteáveis na Roleta Semanal da gamificação",
    icon: Sparkles,
  },
];

export default function AdminPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Administração</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie usuários, planos, checkouts e modelos de IA</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 transition-shadow hover:shadow-md flex items-start gap-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <s.icon size={18} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground shrink-0 mt-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}
