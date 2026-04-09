import { create } from 'zustand';
import type { PlantStock, ActivityRecord, Shipment, Document, Alert, Notification, ApprovalRecord } from '../data/types';
import { api } from '../data/mockData';
import { fetchApiData, clearCache } from '../data/api';
import { getLastUpdated } from '../data/indexedDb';
import type { ApiRow } from '../data/api';

function deriveNotifications(rows: ApiRow[]): Notification[] {
  return rows
    .filter((r) => r.masuk > 0 || r.keluar > 0 || r.mati > 0)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .slice(0, 50)
    .map((r, i) => {
      const jenis: 'masuk' | 'keluar' | 'mati' = r.keluar > 0 ? 'keluar' : r.masuk > 0 ? 'masuk' : 'mati';
      const jumlah = r.keluar > 0 ? r.keluar : r.masuk > 0 ? r.masuk : r.mati;
      return {
        id: `notif-${i}`,
        tanggal: r.tanggal,
        bibit: r.bibit,
        jumlah,
        jenis,
        sumber: r.sumber,
        tujuan: r.tujuan,
        statusKirim: r.statusKirim || 'Baru',
        read: false,
      };
    });
}

interface AppState {
  // Data
  plants: PlantStock[];
  activities: ActivityRecord[];
  shipments: Shipment[];
  documents: Document[];
  alerts: Alert[];
  notifications: Notification[];
  approvals: ApprovalRecord[];

  // Admin mode
  isAdmin: boolean;
  adminPassword: string;

  // Input form (persists across navigation)
  inputForm: { tanggal: string; bibit: string; masuk: string; keluar: string; mati: string; sumber: string; tujuan: string; dibuatOleh: string; driver: string };
  setInputForm: (patch: Partial<AppState['inputForm']>) => void;
  resetInputForm: () => void;

  // Offline sync
  lastUpdated: string | null;

  // Loading states
  loadingPlants: boolean;
  loadingActivities: boolean;
  loadingShipments: boolean;
  loadingDocuments: boolean;
  loadingAlerts: boolean;
  loadingNotifications: boolean;
  submitting: boolean;

  // Actions
  loadLastUpdated: () => Promise<void>;
  fetchPlants: () => Promise<void>;
  fetchActivities: () => Promise<void>;
  fetchShipments: () => Promise<void>;
  fetchDocuments: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  refreshAll: () => Promise<void>;
  submitActivity: (record: Omit<ActivityRecord, 'id'>) => Promise<void>;
  generateDocument: (shipmentId: string) => Promise<void>;
  markAlertRead: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setAdminMode: (password: string) => boolean;
  clearAdminMode: () => void;
  approveSuratJalan: (id: string, approvedBy: string) => void;
  rejectSuratJalan: (id: string, reason: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  plants: [],
  activities: [],
  shipments: [],
  documents: [],
  alerts: [],
  notifications: [],
  approvals: [],

  isAdmin: false,
  adminPassword: 'admin123',

  inputForm: {
    tanggal: new Date().toISOString().split('T')[0],
    bibit: '',
    masuk: '',
    keluar: '',
    mati: '',
    sumber: '',
    tujuan: '',
    dibuatOleh: '',
    driver: '',
  },

  setInputForm: (patch) => {
    set((state) => ({ inputForm: { ...state.inputForm, ...patch } }));
  },

  resetInputForm: () => {
    set({
      inputForm: {
        tanggal: new Date().toISOString().split('T')[0],
        bibit: '',
        masuk: '',
        keluar: '',
        mati: '',
        sumber: '',
        tujuan: '',
        dibuatOleh: '',
        driver: '',
      },
    });
  },

  lastUpdated: null,

  loadingPlants: false,
  loadingActivities: false,
  loadingShipments: false,
  loadingDocuments: false,
  loadingAlerts: false,
  loadingNotifications: false,
  submitting: false,

  loadLastUpdated: async () => {
    try {
      const ts = await getLastUpdated();
      set({ lastUpdated: ts });
    } catch { /* ignore */ }
  },

  fetchPlants: async () => {
    set({ loadingPlants: true });
    const plants = await api.getPlants();
    set({ plants, loadingPlants: false });
  },

  fetchActivities: async () => {
    set({ loadingActivities: true });
    const activities = await api.getActivities();
    set({ activities, loadingActivities: false });
  },

  fetchShipments: async () => {
    set({ loadingShipments: true });
    const shipments = await api.getShipments();
    set({ shipments, loadingShipments: false });
  },

  fetchDocuments: async () => {
    set({ loadingDocuments: true });
    const documents = await api.getDocuments();
    set({ documents, loadingDocuments: false });
  },

  fetchAlerts: async () => {
    set({ loadingAlerts: true });
    const alerts = await api.getAlerts();
    set({ alerts, loadingAlerts: false });
  },

  fetchNotifications: async () => {
    set({ loadingNotifications: true });
    try {
      const rows = await fetchApiData();
      const notifications = deriveNotifications(rows);
      const ts = await getLastUpdated();
      set({ notifications, loadingNotifications: false, lastUpdated: ts });
    } catch {
      set({ loadingNotifications: false });
    }
  },

  refreshAll: async () => {
    clearCache();
    const { fetchPlants, fetchActivities, fetchAlerts, fetchNotifications, loadLastUpdated } = get();
    await Promise.all([fetchPlants(), fetchActivities(), fetchAlerts(), fetchNotifications()]);
    await loadLastUpdated();
  },

  submitActivity: async (record) => {
    set({ submitting: true });
    try {
      const newActivity = await api.submitActivity(record);
      clearCache();
      set((state) => ({
        activities: [newActivity, ...state.activities],
        submitting: false,
      }));
      // Refresh data dari server setelah submit
      get().refreshAll();
    } catch (err) {
      set({ submitting: false });
      throw err;
    }
  },

  generateDocument: async (shipmentId) => {
    set({ submitting: true });
    const doc = await api.generateDocument(shipmentId);
    set((state) => ({
      documents: [doc, ...state.documents],
      submitting: false,
    }));
  },

  markAlertRead: (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
    }));
  },

  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  setAdminMode: (password) => {
    const correctPassword = 'admin123';
    if (password === correctPassword) {
      set({ isAdmin: true, adminPassword: password });
      return true;
    }
    return false;
  },

  clearAdminMode: () => {
    set({ isAdmin: false, adminPassword: '' });
  },

  approveSuratJalan: (nomorSurat, approvedBy) => {
    set((state) => {
      const exists = state.approvals.find((a) => a.nomorSurat === nomorSurat);
      if (exists) {
        return {
          approvals: state.approvals.map((a) =>
            a.nomorSurat === nomorSurat
              ? { ...a, status: 'approved' as const, approvedBy, approvedAt: new Date().toISOString() }
              : a
          ),
        };
      }
      const newApproval: ApprovalRecord = {
        id: `approval-${Date.now()}`,
        nomorSurat,
        tanggal: new Date().toISOString().split('T')[0],
        bibit: '-',
        jumlah: 0,
        tujuan: '-',
        status: 'approved',
        dibuatOleh: approvedBy,
        approvedBy,
        approvedAt: new Date().toISOString(),
      };
      return { approvals: [newApproval, ...state.approvals] };
    });
  },

  rejectSuratJalan: (nomorSurat, reason) => {
    set((state) => {
      const exists = state.approvals.find((a) => a.nomorSurat === nomorSurat);
      if (exists) {
        return {
          approvals: state.approvals.map((a) =>
            a.nomorSurat === nomorSurat
              ? { ...a, status: 'rejected' as const, rejectionReason: reason }
              : a
          ),
        };
      }
      const newApproval: ApprovalRecord = {
        id: `approval-${Date.now()}`,
        nomorSurat,
        tanggal: new Date().toISOString().split('T')[0],
        bibit: '-',
        jumlah: 0,
        tujuan: '-',
        status: 'rejected',
        dibuatOleh: '-',
        rejectionReason: reason,
      };
      return { approvals: [newApproval, ...state.approvals] };
    });
  },
}));
