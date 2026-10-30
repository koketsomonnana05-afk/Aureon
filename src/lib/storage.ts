import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from "firebase/firestore";

export interface LifeOSData {
  roadmap: any | null;
  xp: number;
  tasks: any[];
  streak: number;
  history: number[];
  userProfile: any;
  lastCompletedDate: string | null;
  chatMessages: any[];
  journals: any[];
}

const LOCAL_STORAGE_KEY = "lifeos-data";

export const saveToLocalStorage = (data: Partial<LifeOSData>) => {
  if (localStorage.getItem("lifeos-consent") !== "true") {
    return;
  }
  try {
    const existing = getFromLocalStorage() || {};
    const merged = { ...existing, ...data };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error("Failed to save to local storage", e);
  }
};

export const getFromLocalStorage = (): LifeOSData | null => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to get from local storage", e);
    return null;
  }
};

export const clearLocalStorage = () => {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
};
