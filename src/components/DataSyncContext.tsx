import React from 'react';

type DataSyncContextValue = {
  revision: number;
  syncing: boolean;
  lastSyncedAt: number | null;
  refreshNow: () => Promise<boolean>;
};

const DataSyncContext = React.createContext<DataSyncContextValue | null>(null);

export function DataSyncProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: DataSyncContextValue;
}) {
  return <DataSyncContext.Provider value={value}>{children}</DataSyncContext.Provider>;
}

export function useDataSync(): DataSyncContextValue {
  const context = React.useContext(DataSyncContext);
  if (!context) {
    throw new Error('useDataSync debe usarse dentro de una ruta protegida de Acredita.');
  }
  return context;
}
