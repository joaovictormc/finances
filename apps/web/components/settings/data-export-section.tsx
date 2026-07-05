"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function DataExportSection() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`${API_URL}/api/user/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao exportar dados");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-controlai-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao exportar seus dados", variant: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" size="sm" onClick={handleExportData} loading={isExporting} className="w-fit">
        <FileDown size={16} />
        Baixar meus dados (JSON)
      </Button>
      <div className="border-t border-border pt-4">
        <DeleteAccountSection />
      </div>
    </div>
  );
}
