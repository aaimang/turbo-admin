import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, apiBlob, post, remove } from './client';

/** A table of the database to back up. */
export interface DatabaseTable {
    name: string;
    rows: number;
    /** MySQL's own count, which it keeps as it goes: near, not exact, and on MySQL 8 up to a day old. */
    rowsEstimated: boolean;
    /** Its data and indexes, when the database says. */
    bytes: number | null;
}

/** A backup built on the server, kept to download until `keptUntilUtc`. */
export interface DatabaseBackup {
    id: string;
    fileName: string;
    tables: string[];
    rows: number;
    bytes: number;
    builtById: number;
    builtByName: string;
    builtAtUtc: string;
    keptUntilUtc: string;
}

const DATABASE_KEY = [ 'database' ] as const;
const BACKUPS_KEY = [ ...DATABASE_KEY, 'backups' ] as const;

export const useDatabaseTables = () => useQuery({
    queryKey: [ ...DATABASE_KEY, 'tables' ],
    queryFn: () => api<{ tables: DatabaseTable[] }>('/database/tables'),
});

export const useDatabaseBackups = () => useQuery({
    queryKey: BACKUPS_KEY,
    queryFn: () => api<{ items: DatabaseBackup[]; keepMinutes: number }>('/database/backups'),
    // A backup goes when its time is up: the list follows without a reload.
    refetchInterval: 60_000,
});

/** Builds a backup of the tables named; a large one runs as a job, which `api` waits out. */
export const useBuildDatabaseBackup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (tables: string[]) => post<DatabaseBackup>('/database/backups', { tables }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }),
    });
};

export const useDeleteDatabaseBackup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => remove<void>(`/database/backups/${encodeURIComponent(id)}`),
        onSettled: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }),
    });
};

/**
 * Saves a backup's SQL file. The file needs the session's header, which a plain link can't
 * carry, so it is fetched and handed to the browser as a download.
 */
export const downloadDatabaseBackup = async (backup: DatabaseBackup) => {
    const url = URL.createObjectURL(await apiBlob(`/database/backups/${encodeURIComponent(backup.id)}/file`));
    const link = document.createElement('a');

    link.href = url;
    link.download = backup.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
