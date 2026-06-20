"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api-client";

export function AiQueryBox() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const res = await api.post<{ answer: string }>("/api/ai/query", { question });
      setAnswer(res.answer);
    } catch {
      setError("Não foi possível obter uma resposta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Pergunte sobre suas finanças</h2>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex: quanto gastei em alimentação esse mês?"
          className="flex-1 h-9 rounded-md border border-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" loading={loading} disabled={!question.trim()}>
          Perguntar
        </Button>
      </form>

      {loading && (
        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <Spinner size="sm" />
          Pensando...
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-4">{error}</p>}

      {answer && !loading && (
        <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm text-foreground">{answer}</div>
      )}
    </div>
  );
}
