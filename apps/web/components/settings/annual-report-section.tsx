"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";

const CURRENT_YEAR = new Date().getFullYear();
const REPORT_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export function AnnualReportSection() {
  const { toast } = useToast();
  const [reportYear, setReportYear] = useState(String(CURRENT_YEAR));
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadReport = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/reports/annual?year=${reportYear}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao gerar relatório");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-anual-${reportYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao gerar relatório anual", variant: "error" });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-end gap-3">
      <Select
        label="Ano"
        value={reportYear}
        onChange={(e) => setReportYear(e.target.value)}
        options={REPORT_YEARS.map((y) => ({ value: String(y), label: String(y) }))}
        className="w-32"
      />
      <Button onClick={handleDownloadReport} loading={isDownloading} size="sm">
        <FileDown size={16} />
        Baixar PDF
      </Button>
    </div>
  );
}
