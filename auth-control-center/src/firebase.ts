import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import { FirestoreErrorInfo, OperationType } from "./types";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without this line
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Log system activity events to Firestore for administrative audit tracing
export async function logAuditEvent(action: string, details: string) {
  try {
    const userEmail = auth.currentUser?.email || "anonymous-system";
    await addDoc(collection(db, "audit_logs"), {
      action,
      details,
      userEmail,
      timestamp: serverTimestamp() || new Date()
    });
  } catch (error) {
    console.error("Failed to write audit transaction log:", error);
  }
}


// Error Handling to comply with Firebase Integration Skill guidelines
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email || null,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error Logged: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: When the application initially boots, test the connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firebase connection verified successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration: The client appears offline.");
    } else {
      // In a fresh project, this doc might not exist, which is a successful connection!
      console.log("Firebase server responded (document may not exist)");
    }
  }
}

testConnection();
