import React, { createContext, useContext, useState } from "react";

export interface ActiveSprintData {
  moduleId: string;
  planId: string;
  planTitle: string;
  modules: any[];
  tips?: string;
  processedModuleIds: string[];
}

export interface ActiveModuleData {
  processedModuleId: string;
  moduleTitle: string;
  sprintTitle: string;
}

interface ActiveSprintContextType {
  activeSprint: ActiveSprintData | null;
  activeModule: ActiveModuleData | null;
  setActiveSprint: (sprint: ActiveSprintData | null) => void;
  setActiveModule: (module: ActiveModuleData | null) => void;
}

const ActiveSprintContext = createContext<ActiveSprintContextType | undefined>(undefined);

export function ActiveSprintProvider({ children }: { children: React.ReactNode }) {
  const [activeSprint, setActiveSprint] = useState<ActiveSprintData | null>(null);
  const [activeModule, setActiveModule] = useState<ActiveModuleData | null>(null);

  return (
    <ActiveSprintContext.Provider
      value={{
        activeSprint,
        activeModule,
        setActiveSprint,
        setActiveModule,
      }}
    >
      {children}
    </ActiveSprintContext.Provider>
  );
}

export function useActiveSprint() {
  const context = useContext(ActiveSprintContext);
  if (!context) {
    throw new Error("useActiveSprint must be used within an ActiveSprintProvider");
  }
  return context;
}
