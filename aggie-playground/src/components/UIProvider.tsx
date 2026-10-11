"use client";

import { createContext, useContext, useState } from "react";
import type { Activity } from "@/lib/types";

interface UICtx {
  hostOpen: boolean;
  editing: Activity | null;
  openHost: () => void;
  openEdit: (a: Activity) => void;
  closeHost: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
}

const Ctx = createContext<UICtx | null>(null);

export function useUI() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUI must be used inside UIProvider");
  return v;
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [hostOpen, setHostOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  };

  return (
    <Ctx.Provider
      value={{
        hostOpen,
        editing,
        openHost: () => {
          setEditing(null);
          setHostOpen(true);
        },
        openEdit: (a) => {
          setEditing(a);
          setHostOpen(true);
        },
        closeHost: () => setHostOpen(false),
        toast,
        showToast,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
