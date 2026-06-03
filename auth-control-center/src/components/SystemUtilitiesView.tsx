import React, { useState, useEffect } from "react";
import { 
  collection, onSnapshot, getDocs, doc, setDoc, serverTimestamp 
} from "firebase/firestore";
import { db, logAuditEvent } from "../firebase";
import { AuditLog } from "../types";
import { 
  ShieldCheck, Download, Upload, RefreshCw, Trash2, Calendar, FileText, 
  Database, AlertTriangle, ShieldAlert, Check, Loader2, ArrowRight, UserCheck, Search
} from "lucide-react";

interface SystemUtilitiesViewProps {
  role: string;
}

export const SystemUtilitiesView: React.FC<SystemUtilitiesViewProps> = ({ role }) => {
  const [activeSubTab, setActiveSubTab] = useState<"Audit" | "Backup">("Audit");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Backup States
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgressMsg, setRestoreProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isOwner = role === "owner";

  // Helper date formatters
  const formatFirebaseDate = (dateTime: any) => {
    if (!dateTime) return "N/A";
    if (dateTime.seconds) {
      return new Date(dateTime.seconds * 1000).toLocaleString();
    }
    if (dateTime instanceof Date) {
      return dateTime.toLocaleString();
    }
    return String(dateTime);
  };

  // Live bind Audit collection
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, "audit_logs"), (snap) => {
      const list: AuditLog[] = [];
      snap.forEach(d => {
        const item = d.data() as AuditLog;
        list.push({
          logId: d.id,
          ...item
        });
      });
      // Sort newest audits first
      list.sort((a,b) => {
        const tA = a.timestamp?.seconds || 0;
        const tB = b.timestamp?.seconds || 0;
        return tB - tA;
      });
      setLogs(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Filter logs
  const filteredLogs = logs.filter(l => {
    if (!searchQuery) return true;
    return l.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
           l.details.toLowerCase().includes(searchQuery.toLowerCase()) || 
           l.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Consolidated Database Snapshot Backups
  const handleDownloadBackup = async () => {
    try {
      setBackingUp(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      // List of all active system collections to include in snapshot
      const targetCollections = [
        "parties",
        "items",
        "shades",
        "machines",
        "rates",
        "tasks",
        "worker_masters",
        "party_orders",
        "grey_stocks",
        "hanks_productions",
        "dyeing_productions",
        "conning_productions",
        "ready_stocks",
        "dispatches",
        "payment_collections",
        "ledger_adjustments",
        "worker_pagars",
        "worker_upaads",
        "worker_loans",
        "worker_haptas"
      ];

      const snapshot: Record<string, any[]> = {};

      for (const colName of targetCollections) {
        setRestoreProgressMsg(`Reading ${colName} records...`);
        const querySnap = await getDocs(collection(db, colName));
        const colList: any[] = [];
        querySnap.forEach(snapDoc => {
          colList.push({
            id: snapDoc.id,
            data: snapDoc.data()
          });
        });
        snapshot[colName] = colList;
      }

      setRestoreProgressMsg("Serializing snapshot blocks...");
      
      // Export as downloadable clean JSON format
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot, null, 2));
      const downloadAnchor = document.createElement("a");
      const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `YarnERP_CompleteSnapshot_Backup_${timestampStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      await logAuditEvent("System Data Snapshot Exported", "Exported complete yarn ERP database snapshot configuration download.");
      setSuccessMsg("System snapshot generated and downloaded successfully as a JSON schema backup!");
      setBackingUp(false);
      setRestoreProgressMsg("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Filing snapshot backup failed: " + err.message);
      setBackingUp(false);
      setRestoreProgressMsg("");
    }
  };

  // Restoration processor from file input
  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (!window.confirm("CRITICAL WARNING: Restoring a snapshot will overwrite elements with the same IDs. Proceed?")) {
      return;
    }

    const file = fileList[0];
    const fileReader = new FileReader();

    fileReader.onload = async (event) => {
      try {
        setRestoring(true);
        setErrorMsg(null);
        setSuccessMsg(null);

        const fileContent = event.target?.result as string;
        const snapshot = JSON.parse(fileContent) as Record<string, any[]>;

        let restoredDocsCount = 0;
        const keys = Object.keys(snapshot);

        for (const colName of keys) {
          setRestoreProgressMsg(`Restoring collection '${colName}'...`);
          const documentRows = snapshot[colName];

          if (Array.isArray(documentRows)) {
            for (const docObj of documentRows) {
              if (docObj && docObj.id && docObj.data) {
                // Restore document with identical keys
                await setDoc(doc(db, colName, docObj.id), docObj.data);
                restoredDocsCount++;
              }
            }
          }
        }

        await logAuditEvent("Restore Snapshot Processed", `Restored total database state. Overwrote ${restoredDocsCount} documents across collections.`);
        setSuccessMsg(`Database state successfully rebuilt! Restored ${restoredDocsCount} documents onto your factory Cloud Firestore database.`);
        setRestoring(false);
        setRestoreProgressMsg("");
      } catch (err: any) {
        console.error(err);
        setErrorMsg("Snapshot parsing failed: " + err.message);
        setRestoring(false);
        setRestoreProgressMsg("");
      }
    };

    fileReader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Alerts Notices */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 text-xs animate-fadeIn">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 font-bold text-sm">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 flex items-center gap-3 text-emerald-400 text-xs animate-fadeIn">
          <Check className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 font-bold text-sm">&times;</button>
        </div>
      )}

      {/* Nav Sub-Tabs Header */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          onClick={() => setActiveSubTab("Audit")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === "Audit" 
              ? "border-indigo-500 text-white bg-slate-900/30" 
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <ShieldCheck className="w-4.5 h-4.5" />
          System audit logs
        </button>
        <button
          onClick={() => setActiveSubTab("Backup")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === "Backup" 
              ? "border-indigo-500 text-white bg-slate-900/30" 
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Database className="w-4.5 h-4.5" />
          Backup & Restore schema
        </button>
      </div>

      {/* SUB-SECTION 1: OPERATIONS AUDIT VIEW */}
      {activeSubTab === "Audit" && (
        <div className="space-y-4">
          
          <div className="flex items-center justify-between gap-4 bg-slate-900 border border-white/10 p-4 rounded-xl">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search audit actions, operators, descriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider font-sans pr-2">
              System Audits Active
            </span>
          </div>

          <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto text-xs font-sans">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                    <th className="py-3 px-4">Audit Trace Date</th>
                    <th className="py-3 px-4">Action category</th>
                    <th className="py-3 px-4">Detailed Description Memo</th>
                    <th className="py-3 px-4">Operator Email Identity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 font-mono">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500 font-sans">No security or operational audits registered inside system logs.</td>
                    </tr>
                  ) : (
                    filteredLogs.map(l => (
                      <tr key={l.logId} className="hover:bg-white/[0.01]">
                        <td className="py-3 px-4 text-cyan-400 font-sans">{formatFirebaseDate(l.timestamp)}</td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded border border-indigo-500/25 bg-indigo-500/10 text-indigo-400 font-sans font-bold">
                            {l.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white text-xs max-w-[400px] truncate leading-normal" title={l.details}>
                          {l.details}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-405 text-slate-400 text-sm">
                          {l.userEmail}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SECTION 2: CLOUD SNAPSHOT BACKUP & RESTORE CONSOLE */}
      {activeSubTab === "Backup" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card A: Secure System Data Download */}
          <div className="bg-slate-950 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-xl w-fit">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Generate Cloud State Backup</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Generates a secure snapshot containing all active documents in Firestore (including items, shades, masters, logs, pagars, and dispatches). The schema downloads instantly as a single formatted JSON snapshot configuration file directly into your local machine and protects against accidental edits.
              </p>
            </div>

            <div className="pt-4 border-t border-white/5">
              <button
                disabled={backingUp || restoring}
                onClick={handleDownloadBackup}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-900 disabled:text-slate-500 text-white text-xs font-bold py-3 rounded-xl uppercase tracking-wider shadow-md flex items-center justify-center gap-2"
              >
                {backingUp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{restoreProgressMsg || "Exporting State..."}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4.5 h-4.5" />
                    <span>Export snapshot dataset</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card B: Restore Data Snapshot */}
          <div className="bg-slate-950 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="p-3 bg-amber-500/10 text-amber-500 border border-amber-500/15 rounded-xl w-fit">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Upload / Restore Data Snapshot</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Restore a previously exported `.json` snapshot backup onto your Yarn ERP cloud instance. 
                <strong>Warning:</strong> Restoring will merge new and overwrite matching documents across references and cannot be undone. Run this option with extreme caution during off-shift hours!
              </p>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              {restoring && (
                <div className="text-xs text-amber-400 font-mono flex items-center gap-2 animate-pulse bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{restoreProgressMsg || "Processing file blocks..."}</span>
                </div>
              )}

              <div className="relative w-full">
                <input 
                  type="file"
                  accept=".json"
                  disabled={restoring || backingUp}
                  onChange={handleRestoreBackup}
                  className="hidden"
                  id="restore-file-uploader"
                />
                <label
                  htmlFor="restore-file-uploader"
                  className="w-full bg-slate-900 border border-dashed border-white/20 hover:border-amber-500/40 text-slate-300 hover:text-amber-400 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors uppercase tracking-wider"
                >
                  <Upload className="w-4.5 h-4.5" />
                  <span>Select JSON backup target</span>
                </label>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
