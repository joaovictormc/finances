"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublishedChangelogRelease } from "@finances/validations";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";
import { ReleaseCard } from "@/components/changelog/release-card";
import { api } from "@/lib/api-client";

export default function ChangelogPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["changelog", "web"],
    queryFn: () => api.get<PublishedChangelogRelease[]>("/api/changelog", { platform: "web" }),
  });

  return (
    <div className="max-w-2xl">
      <BackButton href="/settings" label="Configurações" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Novidades</h1>
        <p className="mt-1 text-sm text-muted-foreground">O que mudou no ControlAI em cada atualização</p>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar as novidades agora.</p>
      ) : data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma novidade publicada ainda.
        </p>
      ) : (
        <ol className="space-y-4">
          {data.map((release) => (
            <li key={release.id} className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
              <ReleaseCard release={release} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
