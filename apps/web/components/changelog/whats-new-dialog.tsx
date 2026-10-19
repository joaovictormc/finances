"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublishedChangelogRelease } from "@finances/validations";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ReleaseCard } from "@/components/changelog/release-card";
import { api } from "@/lib/api-client";

/**
 * "O que há de novo": aparece uma vez, na primeira abertura depois de uma
 * novidade publicada. Fechar (por qualquer caminho) marca como visto, e a
 * mesma novidade não volta; o histórico fica em /novidades.
 */
export function WhatsNewDialog() {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const { data } = useQuery({
    queryKey: ["changelog", "unseen", "web"],
    queryFn: () => api.get<PublishedChangelogRelease[]>("/api/changelog/unseen", { platform: "web" }),
    // Uma checagem por sessão basta: não refaz ao trocar de tela.
    staleTime: Infinity,
  });

  const releases = data ?? [];
  const open = !dismissed && releases.length > 0;

  function close() {
    setDismissed(true);
    void api.post("/api/changelog/seen", {}).then(() => {
      queryClient.setQueryData(["changelog", "unseen", "web"], []);
    });
  }

  return (
    <Modal open={open} onClose={close} title="O que há de novo">
      <div className="space-y-6">
        {releases.map((release) => (
          <ReleaseCard key={release.id} release={release} compact />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Link href="/novidades" onClick={close} className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Ver todas as novidades
        </Link>
        <Button type="button" onClick={close}>
          Entendi
        </Button>
      </div>
    </Modal>
  );
}
