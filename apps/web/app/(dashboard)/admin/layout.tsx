"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api-client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api
      .get("/api/admin/users")
      .then(() => setAllowed(true))
      .catch(() => router.replace("/overview"))
      .finally(() => setChecking(false));
  }, [router]);

  if (checking || !allowed) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
