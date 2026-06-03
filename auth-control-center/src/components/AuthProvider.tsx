import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, handleFirestoreError } from "../firebase";
import { UserProfile, WorkerLookup, OperationType } from "../types";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  workerProfile: WorkerLookup | null;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  logout: () => Promise<void>;
  refreshProfile: (uid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  workerProfile: null,
  loading: true,
  error: null,
  setError: () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [workerProfile, setWorkerProfile] = useState<WorkerLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (uid: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        setUserProfile(data);

        // If the role is worker, load their worker profile
        if (data.role === "worker") {
          // Find their worker lookup record or match via workerId
          const workerId = data.workerId || `W-${uid.substring(0, 5).toUpperCase()}`;
          const workerRef = doc(db, "workers", workerId);
          const workerSnap = await getDoc(workerRef);
          
          if (workerSnap.exists()) {
            setWorkerProfile(workerSnap.data() as WorkerLookup);
          } else {
            setWorkerProfile(null);
          }
        } else {
          setWorkerProfile(null);
        }
      } else {
        // Automatically create user profile if signed in but no profile exists
        const currentUser = auth.currentUser;
        if (currentUser) {
          const email = currentUser.email || "";
          let role: "owner" | "manager" | "worker" = "worker";
          
          // Elevate specified emails to owner/manager automatically
          if (email.toLowerCase() === "rb.jariwala111@gmail.com" || email.toLowerCase() === "owner@demo.net") {
            role = "owner";
          } else if (email.toLowerCase() === "manager@demo.net") {
            role = "manager";
          }
          
          const newProfile = {
            userId: uid,
            email: email,
            role: role,
            displayName: currentUser.displayName || email.split("@")[0],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile as UserProfile);
          setWorkerProfile(null);
        } else {
          setUserProfile(null);
          setWorkerProfile(null);
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      // Let's degrade gracefully but set the error
      setError("Unable to retrieve user role permissions from resource gate.");
    }
  };

  const refreshProfile = async (uid: string) => {
    setLoading(true);
    await fetchProfile(uid);
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setError(null);
      
      if (currentUser) {
        await fetchProfile(currentUser.uid);
      } else {
        setUserProfile(null);
        setWorkerProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setWorkerProfile(null);
      setError(null);
    } catch (err) {
      setError("An error occurred during logout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        workerProfile,
        loading,
        error,
        setError,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
